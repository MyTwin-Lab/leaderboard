import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { PlatformRegistry } from "./platform.js";

const descriptor = (key: string) => ({ key, label: key, longLabel: key, icon: key, briefRequired: false, publiclyVisible: false });
const noop = async () => {};

beforeEach(() => {
  PlatformRegistry.reset();
});

afterAll(() => {
  PlatformRegistry.reset();
});

describe("PlatformRegistry — events and subscriptions", () => {
  it("lists events with their emitter, and subscriptions with their owner", () => {
    PlatformRegistry.install({
      flows: [{ descriptor: descriptor("code"), events: [{ type: "evaluation.requested" }] }],
      modules: [
        { key: "onboarding", label: "Onboarding", subscriptions: [{ key: "onboarding.validated-task", event: "evaluation.requested", handle: noop }] },
      ],
    });

    expect(PlatformRegistry.event("evaluation.requested")).toMatchObject({ owner: "flow:code" });
    expect(PlatformRegistry.subscriptions()).toMatchObject([{ key: "onboarding.validated-task", owner: "module:onboarding" }]);
    expect(PlatformRegistry.modules().map((module) => module.key)).toEqual(["onboarding"]);
  });

  it("refuses an event declared by two owners", () => {
    expect(() =>
      PlatformRegistry.install({
        flows: [{ descriptor: descriptor("code"), events: [{ type: "task.created" }] }],
        modules: [{ key: "onboarding", events: [{ type: "task.created" }] }],
      }),
    ).toThrow('Event "task.created" is declared by both flow:code and module:onboarding');
    expect(PlatformRegistry.isInstalled()).toBe(false);
  });

  it("refuses a subscription to an event nothing declares", () => {
    expect(() =>
      PlatformRegistry.install({
        flows: [],
        modules: [{ key: "onboarding", subscriptions: [{ key: "onboarding.meeting", event: "ui.meeting_link_opened", handle: noop }] }],
      }),
    ).toThrow('listens to "ui.meeting_link_opened", which nothing declares');
  });

  it("refuses two subscriptions with the same key, since the key is the cursor", () => {
    expect(() =>
      PlatformRegistry.install({
        flows: [{ descriptor: descriptor("code"), events: [{ type: "evaluation.requested" }] }],
        modules: [
          { key: "a", subscriptions: [{ key: "shared", event: "evaluation.requested", handle: noop }] },
          { key: "b", subscriptions: [{ key: "shared", event: "evaluation.requested", handle: noop }] },
        ],
      }),
    ).toThrow('Subscription "shared" is declared by both module:a and module:b');
  });
});
