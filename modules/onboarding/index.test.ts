import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";

const h = vi.hoisted(() => ({
  repo: { record: vi.fn(), initLegacyRow: vi.fn() },
}));

vi.mock("../../packages/database-service/repositories/onboardingProgress.repo.js", () => ({
  OnboardingProgressRepository: class {
    constructor() {
      return h.repo;
    }
  },
}));

import { PlatformRegistry } from "../../packages/registry/platform.js";
import { onboardingModule } from "./index.js";

const occurredAt = new Date("2026-09-15T10:00:00Z");
const descriptor = (key: string) => ({ key, label: key, longLabel: key, icon: key, briefRequired: false, publiclyVisible: false });

function subscription(key: string) {
  const found = PlatformRegistry.subscriptions().find((s) => s.key === key);
  if (!found) throw new Error(`No subscription ${key}`);
  return found;
}

beforeEach(() => {
  PlatformRegistry.reset();
  vi.clearAllMocks();
  h.repo.record.mockResolvedValue(true);
  h.repo.initLegacyRow.mockResolvedValue(undefined);
});

afterAll(() => {
  PlatformRegistry.reset();
});

describe("onboardingModule", () => {
  it("stays off until an admin turns it on", () => {
    expect(onboardingModule.defaultEnabled).toBe(false);
  });

  it("installs alone: its quests complete on events the core emits", () => {
    PlatformRegistry.install({ flows: [], modules: [onboardingModule] });

    expect(PlatformRegistry.quests().map((quest) => quest.key)).toEqual([
      "clicked_challenge",
      "assigned_task",
      "evaluated_contribution",
    ]);
    expect(PlatformRegistry.subscriptions().map((s) => [s.key, s.owner, s.event])).toEqual(
      expect.arrayContaining([
        ["onboarding.init-progress", "module:onboarding", "user.created"],
        ["quests.clicked_challenge", "module:onboarding", "ui.challenge_opened"],
        ["quests.assigned_task", "module:onboarding", "task.created"],
        ["quests.evaluated_contribution", "module:onboarding", "contribution.evaluated"],
      ]),
    );
  });

  it("records a quest for the user the event names, dated by the event, and for no one otherwise", async () => {
    PlatformRegistry.install({ flows: [], modules: [onboardingModule] });

    await subscription("quests.assigned_task").handle({ id: 1, type: "task.created", payload: { userId: "alice", taskId: "t1" }, occurredAt });
    await subscription("quests.assigned_task").handle({ id: 2, type: "task.created", payload: { taskId: "t2" }, occurredAt });

    expect(h.repo.record).toHaveBeenCalledOnce();
    expect(h.repo.record).toHaveBeenCalledWith("alice", "assigned_task", occurredAt);
  });

  it("records the quests other owners declare", async () => {
    PlatformRegistry.install({
      flows: [
        {
          descriptor: descriptor("code"),
          events: [{ type: "evaluation.requested" }],
          quests: [{ key: "validated_task", label: "Validate a task", event: "evaluation.requested", userOf: (e) => String(e.payload.userId) }],
        },
      ],
      modules: [onboardingModule],
    });

    await subscription("quests.validated_task").handle({ id: 3, type: "evaluation.requested", payload: { userId: "bob" }, occurredAt });

    expect(h.repo.record).toHaveBeenCalledWith("bob", "validated_task", occurredAt);
  });

  it("initializes the progress of a new account", async () => {
    PlatformRegistry.install({ flows: [], modules: [onboardingModule] });

    await subscription("onboarding.init-progress").handle({ id: 4, type: "user.created", payload: { userId: "carol" }, occurredAt });
    await subscription("onboarding.init-progress").handle({ id: 5, type: "user.created", payload: {}, occurredAt });

    expect(h.repo.initLegacyRow).toHaveBeenCalledOnce();
    expect(h.repo.initLegacyRow).toHaveBeenCalledWith("carol");
  });
});
