import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { PlatformRegistry } from "../../packages/registry/platform.js";
import { meetingsModule } from "./index.js";

beforeEach(() => {
  PlatformRegistry.reset();
});

afterAll(() => {
  PlatformRegistry.reset();
});

describe("meetingsModule", () => {
  it("stays off until an admin turns it on", () => {
    expect(meetingsModule.defaultEnabled).toBe(false);
  });

  it("declares the event its quest completes on, so it installs alone", () => {
    PlatformRegistry.install({ flows: [], modules: [meetingsModule] });

    expect(PlatformRegistry.event("ui.meeting_link_opened")).toMatchObject({ owner: "module:meetings" });
    expect(PlatformRegistry.quests()).toMatchObject([{ key: "joined_meeting", owner: "module:meetings" }]);
  });

  it("credits the quest to the user the event names, and to no one otherwise", () => {
    const quest = meetingsModule.quests![0];
    const occurredAt = new Date("2026-09-15T10:00:00Z");

    expect(quest.userOf({ id: 1, type: "ui.meeting_link_opened", payload: { userId: "alice", meetingId: "m1" }, occurredAt })).toBe("alice");
    expect(quest.userOf({ id: 2, type: "ui.meeting_link_opened", payload: { meetingId: "m1" }, occurredAt })).toBeNull();
  });
});
