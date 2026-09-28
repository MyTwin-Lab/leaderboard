import { describe, it, expect } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { prepareBundle, releaseBundle } from "./bundle.js";


async function snapshotDirs(): Promise<Set<string>> {
  return new Set((await fs.readdir(os.tmpdir())).filter((name) => name.startsWith("eval_agent-")));
}

describe("prepareBundle", () => {
  it("écrit dans un dossier mkdtemp court, même pour 50 commits (plus d'ENAMETOOLONG)", async () => {
    const shas = Array.from({ length: 50 }, (_, i) => `${"a".repeat(38)}${String(i).padStart(2, "0")}`);
    const prepared = await prepareBundle({
      snapshotId: shas.join("_"),
      commitShas: shas,
      modifiedFiles: [{ path: "src/deep/a.ts", content: "export const a = 1;" } as any],
    });

    try {
      const workspace = prepared.workspacePath!;
      expect(path.dirname(workspace)).toBe(path.resolve(os.tmpdir()));
      expect(path.basename(workspace).length).toBeLessThan(40);
      expect(await fs.readFile(path.join(workspace, "src/deep/a.ts"), "utf8")).toBe("export const a = 1;");
      // Le contenu ne ressort pas dans le snapshot allégé.
      expect((prepared.modifiedFiles[0] as any).content).toBeUndefined();
    } finally {
      await releaseBundle(prepared);
    }
  });

  it("donne deux dossiers distincts à deux préparations du même commit", async () => {
    const snapshot = { commitSha: "abc", modifiedFiles: [{ path: "a.txt", content: "x" } as any] };
    const first = await prepareBundle(snapshot);
    const second = await prepareBundle(snapshot);
    try {
      expect(first.workspacePath).not.toBe(second.workspacePath);
    } finally {
      await releaseBundle(first);
      await releaseBundle(second);
    }
  });

  it.each([
    ["un chemin relatif remontant", `../escape-${process.pid}-${Date.now()}.txt`],
    ["un chemin imbriqué remontant", `src/../../escape-${process.pid}-${Date.now()}.txt`],
    ["un chemin absolu", path.join(os.tmpdir(), `abs-escape-${process.pid}-${Date.now()}.txt`)],
  ])("refuse %s et ne laisse aucun dossier derrière", async (_label, badPath) => {
    const before = await snapshotDirs();

    await expect(
      prepareBundle({ modifiedFiles: [{ path: badPath, content: "pwned" } as any] })
    ).rejects.toThrow(/outside the bundle/);

    const leftovers = [...(await snapshotDirs())].filter((name) => !before.has(name));
    expect(leftovers).toEqual([]);
    const escaped = path.isAbsolute(badPath) ? badPath : path.join(os.tmpdir(), path.basename(badPath));
    await expect(fs.stat(escaped)).rejects.toThrow();
  });
});

describe("releaseBundle", () => {
  it("supprime le workspace et reste idempotent", async () => {
    const prepared = await prepareBundle({ modifiedFiles: [{ path: "a.txt", content: "x" } as any] });

    await releaseBundle(prepared);
    await expect(fs.stat(prepared.workspacePath!)).rejects.toThrow();
    await expect(releaseBundle(prepared)).resolves.toBeUndefined();
  });

  it("ne fait rien sans workspace", async () => {
    await expect(releaseBundle(undefined)).resolves.toBeUndefined();
    await expect(releaseBundle({ workspacePath: undefined })).resolves.toBeUndefined();
  });

  it("refuse de supprimer un dossier qu'il n'a pas créé", async () => {
    const foreign = await fs.mkdtemp(path.join(os.tmpdir(), "not-a-snapshot-"));
    try {
      await releaseBundle({ workspacePath: foreign });
      expect((await fs.stat(foreign)).isDirectory()).toBe(true);
    } finally {
      await fs.rm(foreign, { recursive: true, force: true });
    }
  });
});
