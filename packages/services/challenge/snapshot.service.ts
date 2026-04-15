import type { ExternalConnector } from "../../connectors/interfaces.js";
import type { SnapshotInfo, ModifiedFile } from "../../evaluator/types.js";

/**
 * SnapshotService
 * ----------------
 * Gère la construction et la préparation des snapshots pour l'évaluation.
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
      snapshotId: orderedShas.join("_"),
      commitSha: orderedShas[orderedShas.length - 1],
      commitShas: orderedShas,
      modifiedFiles: Array.from(uniqueFiles.values()),
    };
  }

  /**
   * Prépare un snapshot pour l'évaluation en créant le workspace temporaire
   */
  async prepareSnapshot(snapshot: SnapshotInfo): Promise<SnapshotInfo> {
    const fs = await import("fs/promises");
    const path = await import("path");
    const os = await import("os");

    const workspaceKey = snapshot.snapshotId ?? snapshot.commitSha ?? `${Date.now()}`;
    const baseDir = path.join(os.tmpdir(), "eval_agent", workspaceKey);
    await fs.mkdir(baseDir, { recursive: true });

    // Enregistrement local des fichiers modifiés
    if (snapshot.modifiedFiles) {
      await Promise.all(
        snapshot.modifiedFiles.map(async (f: any) => {
          const fullPath = path.join(baseDir, f.path);
          await fs.mkdir(path.dirname(fullPath), { recursive: true });
          await fs.writeFile(fullPath, f.content ?? "", "utf8");
        })
      );
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
}
