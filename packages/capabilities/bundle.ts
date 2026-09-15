import type { ExternalConnector } from "../connectors/interfaces.js";
import type { SnapshotInfo, ModifiedFile } from "../evaluator/types.js";

/** Préfixe des dossiers créés par `prepareBundle` sous `os.tmpdir()`. */
const BUNDLE_DIR_PREFIX = "eval_agent-";

/**
 * Capacité `bundle`
 * -----------------
 * Un bundle est ce que l'agent d'évaluation lit : des fichiers écrits dans un
 * dossier temporaire, parcouru avec son outil `read_file`. Une source de bundle
 * (contenu installé) rassemble les fichiers ; le core les écrit sur disque et
 * les supprime.
 *
 * Cycle de vie d'un workspace : `prepareBundle` le crée, l'appelant l'utilise,
 * puis appelle `releaseBundle` dans un `finally`. Les fichiers écrits sont du
 * code ou des données tierces : ils ne doivent ni survivre à l'évaluation, ni
 * sortir du dossier du bundle.
 */

/**
 * Rassemble le contenu de plusieurs éléments d'un connecteur (des commits, le
 * plus souvent) : pour un même chemin, la version la plus récente l'emporte.
 * `null` si un élément n'a pas de connecteur ou si rien n'a été trouvé.
 */
export async function aggregateItems(
  resolveConnector: (itemId: string) => ExternalConnector | undefined,
  itemIds: string[],
): Promise<SnapshotInfo | null> {
  const orderedIds = Array.from(new Set(itemIds));
  const uniqueFiles = new Map<string, ModifiedFile>();

  for (const itemId of orderedIds) {
    const connector = resolveConnector(itemId);
    if (!connector) {
      console.warn(`[bundle] No connector found for item ${itemId}`);
      return null;
    }

    const snapshot = await connector.fetchItemContent(itemId);
    const files: ModifiedFile[] = snapshot?.modifiedFiles ?? [];

    if (files.length === 0) {
      console.warn(`[bundle] No modified files found for item ${itemId}`);
    }

    files.forEach((file: ModifiedFile) => {
      uniqueFiles.set(file.path, {
        ...file,
        lastSeenIn: itemId,
      });
    });
  }

  if (uniqueFiles.size === 0) {
    return null;
  }

  return {
    // Identifiant informatif uniquement : il ne sert pas de nom de dossier
    // (au-delà de ~7 SHA, il dépassait 255 octets et mkdir levait ENAMETOOLONG).
    snapshotId: orderedIds.join("_"),
    commitSha: orderedIds[orderedIds.length - 1],
    commitShas: orderedIds,
    modifiedFiles: Array.from(uniqueFiles.values()),
  };
}

/**
 * Écrit un bundle dans un workspace temporaire.
 *
 * Le dossier vient de `mkdtemp` : nom court et unique, donc ni collision
 * entre deux évaluations concurrentes du même contenu, ni ENAMETOOLONG.
 * Chaque chemin de fichier est confiné au dossier : un `path` du type
 * `../../x` ou absolu est refusé, et le dossier est alors supprimé.
 */
export async function prepareBundle(snapshot: SnapshotInfo): Promise<SnapshotInfo> {
  const fs = await import("fs/promises");
  const path = await import("path");
  const os = await import("os");

  const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), BUNDLE_DIR_PREFIX));

  try {
    if (snapshot.modifiedFiles) {
      await Promise.all(
        snapshot.modifiedFiles.map(async (f) => {
          const fullPath = resolveInside(path, baseDir, f.path);
          await fs.mkdir(path.dirname(fullPath), { recursive: true });
          await fs.writeFile(fullPath, f.content ?? "", "utf8");
        })
      );
    }
  } catch (error) {
    await fs.rm(baseDir, { recursive: true, force: true }).catch(() => {});
    throw error;
  }

  // Le bundle allégé, avec le chemin du workspace : le contenu reste sur disque.
  return {
    ...snapshot,
    modifiedFiles: snapshot.modifiedFiles?.map((f) => ({
      path: f.path,
      status: f.status,
      additions: f.additions,
      deletions: f.deletions,
    })),
    workspacePath: baseDir,
  };
}

/**
 * Supprime le workspace créé par `prepareBundle`. Idempotent, jamais fatal :
 * à appeler dans un `finally`, où une erreur de nettoyage ne doit pas masquer
 * celle de l'évaluation.
 *
 * Garde-fou : seul un dossier `eval_agent-*` directement sous `os.tmpdir()`
 * est supprimé — un `workspacePath` inattendu n'entraîne jamais un `rm -r`
 * ailleurs sur le disque.
 */
export async function releaseBundle(snapshot: Pick<SnapshotInfo, "workspacePath"> | null | undefined): Promise<void> {
  const workspacePath = snapshot?.workspacePath;
  if (!workspacePath) return;

  const fs = await import("fs/promises");
  const path = await import("path");
  const os = await import("os");

  const resolved = path.resolve(workspacePath);
  const isOurs =
    path.dirname(resolved) === path.resolve(os.tmpdir()) &&
    path.basename(resolved).startsWith(BUNDLE_DIR_PREFIX);
  if (!isOurs) {
    console.warn(`[bundle] Refusing to clean up unexpected workspace path: ${workspacePath}`);
    return;
  }

  await fs.rm(resolved, { recursive: true, force: true }).catch((error) => {
    console.warn(`[bundle] Failed to clean up ${resolved}:`, error);
  });
}

/**
 * Chemin absolu de `relativePath` dans `baseDir`, ou exception s'il en sort
 * (`..`, chemin absolu, autre lecteur sous Windows, octet nul).
 */
function resolveInside(path: typeof import("path"), baseDir: string, relativePath: unknown): string {
  if (typeof relativePath !== "string" || relativePath.length === 0 || relativePath.includes("\0")) {
    throw new Error(`[bundle] Invalid file path in bundle: ${String(relativePath)}`);
  }
  const fullPath = path.resolve(baseDir, relativePath);
  const rel = path.relative(baseDir, fullPath);
  if (rel === "" || rel === ".." || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) {
    throw new Error(`[bundle] Refusing to write outside the bundle directory: ${relativePath}`);
  }
  return fullPath;
}
