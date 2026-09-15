import { describe, it, expect, vi } from "vitest";
import { createKaggleArtifactSource } from "./index.js";

function makeSource(opts: { items?: number; connector?: null } = {}) {
  const connector = {
    connect: vi.fn(async () => {}),
    disconnect: vi.fn(async () => {}),
    fetchItems: vi.fn(async () => Array.from({ length: opts.items ?? 2 }, (_, i) => ({ id: `v${i}` }))),
    fetchItemContent: vi.fn(async (id: string) => ({ commitSha: id, modifiedFiles: [{ path: "data.csv", content: "a,b" }] })),
  };
  const createConnector = vi.fn(async () => (opts.connector === null ? null : (connector as any)));
  return { source: createKaggleArtifactSource({ createConnector }), connector, createConnector };
}

describe("kaggle-artifact bundle source", () => {
  it("collects the most recent item of the artifact", async () => {
    const { source, connector, createConnector } = makeSource();

    const bundle = await source.collect({ ref: "alice/penguins", repoType: "kaggle_dataset" });

    expect(createConnector).toHaveBeenCalledWith("alice/penguins", "kaggle_dataset");
    expect(connector.fetchItemContent).toHaveBeenCalledWith("v0");
    expect(bundle.refs).toEqual(["v0"]);
    expect(bundle.snapshot.modifiedFiles).toEqual([{ path: "data.csv", content: "a,b" }]);

    await bundle.release!();
    expect(connector.disconnect).toHaveBeenCalledTimes(1);
  });

  it("fails on an empty artifact, and closes the connection", async () => {
    const { source, connector } = makeSource({ items: 0 });

    await expect(source.collect({ ref: "alice/penguins", repoType: "kaggle_dataset" })).rejects.toThrow(
      /Nothing to evaluate at alice\/penguins/,
    );
    expect(connector.disconnect).toHaveBeenCalledTimes(1);
  });

  it("fails when no connector reads this artifact type", async () => {
    const { source } = makeSource({ connector: null });

    await expect(source.collect({ ref: "alice/penguins", repoType: "kaggle_dataset" })).rejects.toThrow(
      /No connector for kaggle_dataset/,
    );
  });
});
