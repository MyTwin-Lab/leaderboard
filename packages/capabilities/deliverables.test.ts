import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { PlatformRegistry, type FlowDefinition } from "../registry/platform.js";
import {
  eligibleDeliverableType,
  flowsValidating,
  requiredDeliverableCapability,
  requiresDeliverable,
} from "./deliverables.js";

function flow(key: string, declarations: Partial<FlowDefinition> = {}): FlowDefinition {
  return {
    descriptor: { key, label: key, longLabel: key, icon: "code", briefRequired: false, publiclyVisible: true },
    ...declarations,
  };
}

describe("deliverables", () => {
  beforeEach(() => {
    PlatformRegistry.reset();
    PlatformRegistry.install({
      flows: [
        flow("app", { deliverables: [{ contributionType: "project", capabilities: ["deployed_app"] }] }),
        flow("model", {
          deliverables: [
            { contributionType: "dataset", capabilities: [] },
            { contributionType: "api", capabilities: ["endpoint", "deployed_app"] },
          ],
        }),
        flow("probe", { requires: { deliverableCapability: "endpoint" } }),
        flow("walk", { requires: { deliverableCapability: "deployed_app" } }),
      ],
    });
  });
  afterEach(() => PlatformRegistry.reset());

  it("reads the capability a flow requires from its parent", () => {
    expect(requiredDeliverableCapability("probe")).toBe("endpoint");
    expect(requiresDeliverable("walk")).toBe(true);
    expect(requiresDeliverable("app")).toBe(false);
    expect(requiresDeliverable("gone")).toBe(false);
  });

  it("finds the contribution type of the source that offers the required capability", () => {
    expect(eligibleDeliverableType("probe", "model")).toBe("api");
    expect(eligibleDeliverableType("walk", "app")).toBe("project");
    expect(eligibleDeliverableType("probe", "app")).toBeNull();
    expect(eligibleDeliverableType("app", "model")).toBeNull();
  });

  it("lists the flows able to test the deliverables of a source flow", () => {
    expect(flowsValidating("app")).toEqual(["walk"]);
    expect(flowsValidating("model")).toEqual(["probe", "walk"]);
    expect(flowsValidating("probe")).toEqual([]);
  });
});
