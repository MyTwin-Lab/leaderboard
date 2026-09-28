import { describe, it, expect } from "vitest";
import { createFlowCatalog, type FlowDescriptor } from "./flows.js";

function descriptor(key: string, overrides: Partial<FlowDescriptor> = {}): FlowDescriptor {
  return {
    key,
    label: key.toUpperCase(),
    longLabel: `The ${key} flow`,
    icon: "code",
    briefRequired: true,
    publiclyVisible: true,
    ...overrides,
  };
}

describe("createFlowCatalog", () => {
  const catalog = createFlowCatalog([descriptor("alpha"), descriptor("beta", { publiclyVisible: false })], {
    defaultKey: "alpha",
  });

  it("finds a flow by its challenge type", () => {
    expect(catalog.get("beta")?.publiclyVisible).toBe(false);
    expect(catalog.get("gamma")).toBeUndefined();
    expect(catalog.get(null)).toBeUndefined();
  });

  it("resolves a missing or unknown type to the default flow", () => {
    expect(catalog.resolve(undefined).key).toBe("alpha");
    expect(catalog.resolve("gamma").key).toBe("alpha");
    expect(catalog.resolve("beta").key).toBe("beta");
  });

  it("lists the flows in declaration order", () => {
    expect(catalog.list().map((d) => d.key)).toEqual(["alpha", "beta"]);
  });

  it("refuses a flow declared twice", () => {
    expect(() => createFlowCatalog([descriptor("alpha"), descriptor("alpha")], { defaultKey: "alpha" })).toThrow(
      /declared twice/
    );
  });

  it("refuses a default flow that is not installed", () => {
    expect(() => createFlowCatalog([descriptor("alpha")], { defaultKey: "beta" })).toThrow(/not in the catalog/);
  });
});
