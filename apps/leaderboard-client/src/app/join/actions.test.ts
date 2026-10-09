import { beforeEach, describe, expect, it, vi } from "vitest";

import type { LabMember } from "@/lib/server/labMember";

const submitLabJoin = vi.fn();
const submitStory = vi.fn();
vi.mock("@/lib/server/crm", () => ({ submitLabJoin, submitStory }));

// Le cookie du membre, tenu en mémoire : ce que le navigateur renverrait.
let cookie: LabMember | null = null;
vi.mock("@/lib/server/labMember", () => ({
  readLabMember: async () => cookie,
  writeLabMember: async (member: LabMember) => {
    cookie = member;
  },
}));

// `redirect` interrompt l'action en levant, comme dans Next.
class Redirect extends Error {}
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Redirect(url);
  },
}));

const { joinLab, shareAnecdote, markWhatsappJoined } = await import("./actions");

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

beforeEach(() => {
  submitLabJoin.mockReset();
  submitStory.mockReset();
  cookie = null;
});

describe("joinLab", () => {
  it("records the member with the declared role, then remembers them", async () => {
    submitLabJoin.mockResolvedValue({ submissionUuid: "sub-1", isFirstOfKind: true });

    const result = await joinLab(form({ email: " Ada@Example.com ", role: "researcher" }));

    expect(result).toEqual({ returning: false });
    expect(submitLabJoin).toHaveBeenCalledWith({
      email: "ada@example.com",
      role: "researcher",
      consentVersion: "2026-10-lab-news",
      utm: { source: "mytwinlab.care", medium: "join-page", campaign: "join-lab" },
    });
    expect(cookie).toEqual({ email: "ada@example.com", steps: [] });
  });

  it("sends « other » when no role, or an unknown one, is given", async () => {
    submitLabJoin.mockResolvedValue({ submissionUuid: "sub-1", isFirstOfKind: true });

    await joinLab(form({ email: "ada@example.com" }));
    await joinLab(form({ email: "ada@example.com", role: "admin" }));

    expect(submitLabJoin.mock.calls.map(([request]) => request.role)).toEqual(["other", "other"]);
  });

  it("tells a returning member apart, and keeps the steps of the same email", async () => {
    cookie = { email: "ada@example.com", steps: ["whatsapp"] };
    submitLabJoin.mockResolvedValue({ submissionUuid: "sub-2", isFirstOfKind: false });

    expect(await joinLab(form({ email: "ada@example.com" }))).toEqual({ returning: true });
    expect(cookie).toEqual({ email: "ada@example.com", steps: ["whatsapp"] });
  });

  it("starts a new email from scratch", async () => {
    cookie = { email: "ada@example.com", steps: ["whatsapp"] };
    submitLabJoin.mockResolvedValue({ submissionUuid: "sub-3", isFirstOfKind: true });

    await joinLab(form({ email: "grace@example.com" }));

    expect(cookie).toEqual({ email: "grace@example.com", steps: [] });
  });

  it("still welcomes the visitor when the CRM is unavailable", async () => {
    submitLabJoin.mockResolvedValue(null);

    expect(await joinLab(form({ email: "ada@example.com" }))).toEqual({ returning: false });
    expect(cookie?.email).toBe("ada@example.com");
  });

  it("refuses an invalid email", async () => {
    expect(await joinLab(form({ email: "not-an-email" }))).toEqual({ error: "invalid" });
    expect(submitLabJoin).not.toHaveBeenCalled();
  });

  it("keeps a filled honeypot out of the CRM and sets no cookie, with the same answer", async () => {
    expect(await joinLab(form({ email: "ada@example.com", website: "https://spam.example" }))).toEqual({
      returning: false,
    });
    expect(submitLabJoin).not.toHaveBeenCalled();
    expect(cookie).toBeNull();
  });
});

describe("shareAnecdote", () => {
  it("sends the story under the member's email, ticks the step and goes back to the welcome page", async () => {
    cookie = { email: "ada@example.com", steps: [] };
    submitStory.mockResolvedValue(true);

    await expect(shareAnecdote({}, form({ content: " My story ", consent: "on" }))).rejects.toThrow(
      "/join/welcome?shared=1",
    );

    expect(submitStory).toHaveBeenCalledWith({
      email: "ada@example.com",
      content: "My story",
      consentVersion: "2026-08-anonymous-internal-use",
    });
    expect(cookie).toEqual({ email: "ada@example.com", steps: ["anecdote"] });
  });

  it("sends a visitor without a member cookie back to /join", async () => {
    await expect(shareAnecdote({}, form({ content: "My story", consent: "on" }))).rejects.toThrow(/^\/join$/);
    expect(submitStory).not.toHaveBeenCalled();
  });

  it("asks for a story and for consent", async () => {
    cookie = { email: "ada@example.com", steps: [] };

    expect(await shareAnecdote({}, form({ content: "  ", consent: "on" }))).toEqual({ error: "empty" });
    expect(await shareAnecdote({}, form({ content: "My story" }))).toEqual({ error: "consent" });
    expect(submitStory).not.toHaveBeenCalled();
  });

  it("stays on the page, step unticked, when the CRM refuses the story", async () => {
    cookie = { email: "ada@example.com", steps: [] };
    submitStory.mockResolvedValue(false);

    expect(await shareAnecdote({}, form({ content: "My story", consent: "on" }))).toEqual({ error: "server" });
    expect(cookie.steps).toEqual([]);
  });
});

describe("markWhatsappJoined", () => {
  it("ticks the step once", async () => {
    cookie = { email: "ada@example.com", steps: ["anecdote"] };

    await markWhatsappJoined();
    await markWhatsappJoined();

    expect(cookie).toEqual({ email: "ada@example.com", steps: ["anecdote", "whatsapp"] });
  });

  it("does nothing without a member", async () => {
    await markWhatsappJoined();
    expect(cookie).toBeNull();
  });
});
