import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { PlatformRegistry, type QuestDeclaration } from "./platform.js";

const descriptor = (key: string) => ({ key, label: key, longLabel: key, icon: key, briefRequired: false, publiclyVisible: false });

const validatedTask: QuestDeclaration = {
  key: "validated_task",
  label: "Launch an evaluation",
  order: 2,
  event: "evaluation.requested",
  userOf: (event) => (typeof event.payload.userId === "string" ? event.payload.userId : null),
};

const clickedChallenge: QuestDeclaration = {
  key: "clicked_challenge",
  label: "Open a challenge",
  order: 1,
  event: "ui.challenge_opened",
  userOf: (event) => (typeof event.payload.userId === "string" ? event.payload.userId : null),
};

beforeEach(() => {
  PlatformRegistry.reset();
});

afterAll(() => {
  PlatformRegistry.reset();
});

describe("PlatformRegistry — quests", () => {
  it("turns each quest into a subscription of the module that records quests", async () => {
    const record = vi.fn(async () => {});
    PlatformRegistry.install({
      flows: [{ descriptor: descriptor("code"), events: [{ type: "evaluation.requested" }], quests: [validatedTask] }],
      modules: [
        { key: "challenge-page", events: [{ type: "ui.challenge_opened" }], quests: [clickedChallenge] },
        { key: "onboarding", questRecorder: { record } },
      ],
    });

    expect(PlatformRegistry.quests().map((quest) => quest.key)).toEqual(["clicked_challenge", "validated_task"]);
    const subscription = PlatformRegistry.subscriptions().find((s) => s.key === "quests.validated_task")!;
    expect(subscription).toMatchObject({ owner: "module:onboarding", event: "evaluation.requested" });

    const occurredAt = new Date("2026-09-15T10:00:00Z");
    await subscription.handle({ id: 1, type: "evaluation.requested", payload: { userId: "alice" }, occurredAt });
    await subscription.handle({ id: 2, type: "evaluation.requested", payload: {}, occurredAt });

    expect(record).toHaveBeenCalledOnce();
    expect(record).toHaveBeenCalledWith("alice", "validated_task", occurredAt);
  });

  it("subscribes nothing while no module records quests", () => {
    PlatformRegistry.install({
      flows: [{ descriptor: descriptor("code"), events: [{ type: "evaluation.requested" }], quests: [validatedTask] }],
    });

    expect(PlatformRegistry.quests()).toHaveLength(1);
    expect(PlatformRegistry.subscriptions()).toEqual([]);
  });

  it("refuses a quest completed by an event nothing declares", () => {
    expect(() =>
      PlatformRegistry.install({ flows: [{ descriptor: descriptor("code"), quests: [validatedTask] }] }),
    ).toThrow('Quest "validated_task" of flow:code completes on "evaluation.requested", which nothing declares');
  });

  it("refuses two modules recording quests", () => {
    const recorder = { record: async () => {} };

    expect(() =>
      PlatformRegistry.install({
        flows: [],
        modules: [
          { key: "onboarding", questRecorder: recorder },
          { key: "gamification", questRecorder: recorder },
        ],
      }),
    ).toThrow("Quests are recorded by both module:onboarding and module:gamification");
  });
});
