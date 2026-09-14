import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const h = vi.hoisted(() => ({
  challengeFindById: vi.fn(),
  findTeamMembers: vi.fn(),
  signalsFindByChallenge: vi.fn(),
  configFindByChallenge: vi.fn(),
  updateCursor: vi.fn(),
  contribFindByChallenge: vi.fn(),
  contribCreate: vi.fn(),
  projectFindById: vi.fn(),
  rewardFindByChallenge: vi.fn(),
  createManyAndSyncRewards: vi.fn(),
  getSlackToken: vi.fn(),
  fetchItems: vi.fn(),
  resolveUserProfile: vi.fn(),
  runDetectAgent: vi.fn(),
}));

vi.mock("../../database-service/repositories/index.js", () => ({
  ChallengeRepository: class { findById = h.challengeFindById; },
  ChallengeTeamRepository: class { findTeamMembers = h.findTeamMembers; },
  ChallengeSignalRepository: class { findByChallenge = h.signalsFindByChallenge; },
  ChallengeSlackConfigRepository: class {
    findByChallenge = h.configFindByChallenge;
    updateCursor = h.updateCursor;
  },
  ContributionRepository: class {
    findByChallenge = h.contribFindByChallenge;
    create = h.contribCreate;
  },
  ProjectRepository: class { findById = h.projectFindById; },
  RewardEntryRepository: class {
    findByChallenge = h.rewardFindByChallenge;
    createManyAndSyncRewards = h.createManyAndSyncRewards;
  },
}));
vi.mock("../../config/slackCredentials.js", () => ({ getSlackToken: h.getSlackToken }));
vi.mock("../../connectors/implementation/Slack.connector.js", () => ({
  SlackConnector: class {
    fetchItems = h.fetchItems;
    resolveUserProfile = h.resolveUserProfile;
  },
}));
vi.mock("../../slack-signal-agent/index.js", () => ({ runDetectAgent: h.runDetectAgent }));

import { SlackSignalsService } from "./slack-signals.service.js";
import { buildDetectionPrompt } from "../../slack-signal-agent/prompts.js";

function message(user: string, ts: string, text: string) {
  return { id: ts, metadata: { user, ts, text } };
}

const PARTICIPANT_MESSAGE = message("U_ALICE", "1700000001.000100", "I fixed the flaky integration test");
const OUTSIDER_MESSAGE = message("U_MALLORY", "1700000002.000200", "secret outsider text about my health");

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});

  h.challengeFindById.mockResolvedValue({
    uuid: "ch-1",
    status: "active",
    title: "Challenge",
    description: null,
    roadmap: null,
    project_id: null,
  });
  h.configFindByChallenge.mockResolvedValue({ channel_id: "C1", channel_name: "general", last_ts: null });
  h.signalsFindByChallenge.mockResolvedValue([
    { uuid: "sig-1", label: "Fix", description: "Fixes a bug", reward_cp: 5 },
  ]);
  h.getSlackToken.mockResolvedValue("xoxb-test");
  h.findTeamMembers.mockResolvedValue([
    { uuid: "user-alice", email: "alice@example.org", full_name: "Alice Martin" },
  ]);
  h.resolveUserProfile.mockImplementation(async (slackUserId: string) =>
    slackUserId === "U_ALICE"
      ? { email: "Alice@example.org", name: "alice" }
      : { email: "mallory@outside.example", name: "Mallory Outsider" }
  );
  h.rewardFindByChallenge.mockResolvedValue([]);
  h.runDetectAgent.mockResolvedValue({ detections: [] });
  h.updateCursor.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SlackSignalsService.processChallenge — données des non-participants", () => {
  it("n'envoie au LLM que les messages de participants, sans nom ni texte des autres", async () => {
    h.fetchItems.mockResolvedValue([PARTICIPANT_MESSAGE, OUTSIDER_MESSAGE]);

    const summary = await new SlackSignalsService().processChallenge("ch-1");

    expect(h.runDetectAgent).toHaveBeenCalledTimes(1);
    const context = h.runDetectAgent.mock.calls[0][0];
    expect(context.messages).toEqual([
      {
        ts: "1700000001.000100",
        author_user_id: "user-alice",
        author_name: "Alice Martin",
        text: "I fixed the flaky integration test",
      },
    ]);

    const prompt = buildDetectionPrompt(context);
    expect(prompt).toContain("I fixed the flaky integration test");
    expect(prompt).not.toContain("Mallory");
    expect(prompt).not.toContain("mallory@outside.example");
    expect(prompt).not.toContain("secret outsider text");

    expect(summary).toMatchObject({ status: "processed", messageCount: 1 });
  });

  it("ne logge ni nom ni email d'auteur non reconnu — seulement le nombre et l'id Slack", async () => {
    h.fetchItems.mockResolvedValue([PARTICIPANT_MESSAGE, OUTSIDER_MESSAGE]);

    await new SlackSignalsService().processChallenge("ch-1");

    const logged = warnSpy.mock.calls.map((args) => args.map(String).join(" ")).join("\n");
    expect(logged).toContain("1 unresolved author");
    expect(logged).toContain("U_MALLORY");
    expect(logged).not.toContain("@");
    expect(logged).not.toContain("Mallory Outsider");
  });

  it("calcule le curseur sur la liste non filtrée : il passe le dernier message, même d'un non-participant", async () => {
    h.fetchItems.mockResolvedValue([PARTICIPANT_MESSAGE, OUTSIDER_MESSAGE]);

    await new SlackSignalsService().processChallenge("ch-1");

    expect(h.updateCursor).toHaveBeenLastCalledWith(
      "ch-1",
      expect.objectContaining({ last_ts: "1700000002.000200", last_error: null })
    );
  });

  it("sans aucun message de participant : pas d'appel LLM, curseur avancé, no_new_messages", async () => {
    h.fetchItems.mockResolvedValue([OUTSIDER_MESSAGE]);

    const summary = await new SlackSignalsService().processChallenge("ch-1");

    expect(h.runDetectAgent).not.toHaveBeenCalled();
    expect(h.updateCursor).toHaveBeenCalledWith(
      "ch-1",
      expect.objectContaining({ last_ts: "1700000002.000200", last_error: null })
    );
    expect(summary).toEqual({ challengeId: "ch-1", status: "no_new_messages", messageCount: 0 });
  });
});

describe("buildDetectionPrompt", () => {
  it("écarte par défense en profondeur un message sans author_user_id", () => {
    const prompt = buildDetectionPrompt({
      challenge: { title: "Challenge" },
      participants: [{ user_id: "user-alice", full_name: "Alice Martin" }],
      signals: [{ signal_id: "sig-1", label: "Fix", reward_cp: 5 }],
      messages: [
        { ts: "1", author_user_id: "user-alice", author_name: "Alice Martin", text: "participant text" },
        { ts: "2", author_user_id: null, author_name: "Mallory Outsider", text: "outsider text" },
      ],
    });
    expect(prompt).toContain("participant text");
    expect(prompt).not.toContain("outsider text");
    expect(prompt).not.toContain("Mallory");
  });
});
