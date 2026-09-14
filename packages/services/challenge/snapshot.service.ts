import type { ExternalConnector } from "../../connectors/interfaces.js";
import type { SnapshotInfo, ModifiedFile } from "../../evaluator/types.js";

/** Préfixe des dossiers créés par `prepareSnapshot` sous `os.tmpdir()`. */
const SNAPSHOT_DIR_PREFIX = "eval_agent-";

/**
 * SnapshotService
 * ----------------
 * Gère la construction et la préparation des snapshots pour l'évaluation.
 *
 * Cycle de vie d'un workspace : `prepareSnapshot` le crée, l'appelant
 * l'utilise, puis appelle `cleanup` dans un `finally`. Les fichiers écrits sont
 * du code tiers : ils ne doivent ni survivre à l'évaluation, ni sortir du
 * dossier du snapshot.
 */
export class SnapshotService {
  /**
   * Construit un snapshot agrégé à partir de plusieurs commits
   */
  async buildAggregatedSnapshot(
    resolveConnector: (commitSha: string) => ExternalConnector | undefined,
    commitShas: string[],
  ): Promise<SnapshotInfo | null> {
    const orderedShas = Array.from(new Set(commitShas));
    const uniqueFiles = new Map<string, ModifiedFile>();

    for (const commitSha of orderedShas) {
      const connector = resolveConnector(commitSha);
      if (!connector) {
        console.warn(`[SnapshotService] No connector found for commit ${commitSha}`);
        return null;
      }

      const snapshot = await connector.fetchItemContent(commitSha);
      const files: ModifiedFile[] = snapshot?.modifiedFiles ?? [];

      if (files.length === 0) {
        console.warn(`[SnapshotService] No modified files found for commit ${commitSha}`);
      }

      files.forEach((file: ModifiedFile) => {
        uniqueFiles.set(file.path, {
          ...file,
          lastSeenIn: commitSha,
        });
      });
    }

    if (uniqueFiles.size === 0) {
      return null;
    }

    return {
      // Identifiant informatif uniquement : il ne sert plus de nom de dossier
      // (au-delà de ~7 SHA, il dépassait 255 octets et mkdir levait ENAMETOOLONG).
      snapshotId: orderedShas.join("_"),
      commitSha: orderedShas[orderedShas.length - 1],
      commitShas: orderedShas,
      modifiedFiles: Array.from(uniqueFiles.values()),
    };
  }

  /**
   * Prépare un snapshot pour l'évaluation en créant le workspace temporaire.
   *
   * Le dossier vient de `mkdtemp` : nom court et unique, donc ni collision
   * entre deux évaluations concurrentes du même commit, ni ENAMETOOLONG.
   * Chaque chemin de fichier est confiné au dossier : un `path` de commit du
   * type `../../x` ou absolu est refusé, et le dossier est alors supprimé.
   */
  async prepareSnapshot(snapshot: SnapshotInfo): Promise<SnapshotInfo> {
    const fs = await import("fs/promises");
    const path = await import("path");
    const os = await import("os");

    const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), SNAPSHOT_DIR_PREFIX));

    try {
      // Enregistrement local des fichiers modifiés
      if (snapshot.modifiedFiles) {
        await Promise.all(
          snapshot.modifiedFiles.map(async (f: any) => {
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

    // Retourner le snapshot allégé avec le chemin du workspace
    return {
      ...snapshot,
      modifiedFiles: snapshot.modifiedFiles?.map((f: any) => ({
        path: f.path,
        status: f.status,
        additions: f.additions,
        deletions: f.deletions,
      })),
      workspacePath: baseDir,
    };
  }

  /**
   * Supprime le workspace créé par `prepareSnapshot`. Idempotent, jamais
   * fatal : à appeler dans un `finally`, où une erreur de nettoyage ne doit
   * pas masquer celle de l'évaluation.
   *
   * Garde-fou : seul un dossier `eval_agent-*` directement sous `os.tmpdir()`
   * est supprimé — un `workspacePath` inattendu n'entraîne jamais un `rm -r`
   * ailleurs sur le disque.
   */
  async cleanup(snapshot: Pick<SnapshotInfo, "workspacePath"> | null | undefined): Promise<void> {
    const workspacePath = snapshot?.workspacePath;
    if (!workspacePath) return;

    const fs = await import("fs/promises");
    const path = await import("path");
    const os = await import("os");

    const resolved = path.resolve(workspacePath);
    const isOurs =
      path.dirname(resolved) === path.resolve(os.tmpdir()) &&
      path.basename(resolved).startsWith(SNAPSHOT_DIR_PREFIX);
    if (!isOurs) {
      console.warn(`[SnapshotService] Refusing to clean up unexpected workspace path: ${workspacePath}`);
      return;
    }

    await fs.rm(resolved, { recursive: true, force: true }).catch((error) => {
      console.warn(`[SnapshotService] Failed to clean up ${resolved}:`, error);
    });
  }
}

/**
 * Chemin absolu de `relativePath` dans `baseDir`, ou exception s'il en sort
 * (`..`, chemin absolu, autre lecteur sous Windows, octet nul).
 */
function resolveInside(path: typeof import("path"), baseDir: string, relativePath: unknown): string {
  if (typeof relativePath !== "string" || relativePath.length === 0 || relativePath.includes("\0")) {
    throw new Error(`[SnapshotService] Invalid file path in snapshot: ${String(relativePath)}`);
  }
  const fullPath = path.resolve(baseDir, relativePath);
  const rel = path.relative(baseDir, fullPath);
  if (rel === "" || rel === ".." || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) {
    throw new Error(`[SnapshotService] Refusing to write outside the snapshot directory: ${relativePath}`);
  }
  return fullPath;
}
