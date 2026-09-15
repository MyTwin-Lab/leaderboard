import { describe, it, expect, vi } from "vitest";
import { createGithubSnapshotSource } from "./index.js";

/** Un connecteur minimal : `fetchItems` rend `count` commits numérotés. */
function makeConnector(count: number) {
  return {
    connect: vi.fn(async () => {}),
    disconnect: vi.fn(async () => {}),
    fetchItems: vi.fn(async () => Array.from({ length: count }, (_, i) => ({ id: `sha-${i}` }))),
    fetchItemContent: vi.fn(),
  };
}

function makeSource(opts: { commits?: number; connector?: null } = {}) {
  const connector = makeConnector(opts.commits ?? 3);
  const createConnector = vi.fn(async () => (opts.connector === null ? null : (connector as any)));
  const aggregate = vi.fn(async (_resolve: any, shas: string[]) => ({
    commitSha: shas[shas.length - 1],
    commitShas: shas,
    modifiedFiles: [{ path: "a.ts", content: "x" }],
  }));
  const source = createGithubSnapshotSource({ createConnector, aggregate });
  return { source, connector, createConnector, aggregate };
}

describe("github-snapshot bundle source", () => {
  it("collects the files of the last commits of the branch", async () => {
    const { source, createConnector, aggregate } = makeSource();

    const bundle = await source.collect({ slug: "acme/widget", branch: "main" });

    expect(createConnector).toHaveBeenCalledWith("acme/widget", "main");
    expect(aggregate.mock.calls[0][1]).toEqual(["sha-0", "sha-1", "sha-2"]);
    expect(bundle.refs).toEqual(["sha-0", "sha-1", "sha-2"]);
    expect(bundle.snapshot.modifiedFiles).toHaveLength(1);
  });

  it("caps the snapshot at 100 commits, or at an explicit maxCommits", async () => {
    const { source, aggregate } = makeSource({ commits: 250 });

    await source.collect({ slug: "acme/widget" });
    await source.collect({ slug: "acme/widget", maxCommits: 5 });

    expect(aggregate.mock.calls[0][1]).toHaveLength(100);
    expect(aggregate.mock.calls[1][1]).toHaveLength(5);
  });

  it("keeps the connection open until the bundle is released", async () => {
    const { source, connector } = makeSource();

    const bundle = await source.collect({ slug: "acme/widget" });
    expect(connector.disconnect).not.toHaveBeenCalled();

    await bundle.release!();
    expect(connector.disconnect).toHaveBeenCalledTimes(1);
  });

  it("fails on a repository without commits, and closes the connection", async () => {
    const { source, connector } = makeSource({ commits: 0 });

    await expect(source.collect({ slug: "acme/widget" })).rejects.toThrow(/No commits found/);
    expect(connector.disconnect).toHaveBeenCalledTimes(1);
  });

  it("fails when no snapshot can be built", async () => {
    const { source, aggregate, connector } = makeSource();
    aggregate.mockResolvedValueOnce(null as any);

    await expect(source.collect({ slug: "acme/widget" })).rejects.toThrow(/Unable to build snapshot/);
    expect(connector.disconnect).toHaveBeenCalledTimes(1);
  });

  it("fails when no GitHub connector is installed", async () => {
    const { source } = makeSource({ connector: null });

    await expect(source.collect({ slug: "acme/widget" })).rejects.toThrow(/No GitHub connector/);
  });
});
