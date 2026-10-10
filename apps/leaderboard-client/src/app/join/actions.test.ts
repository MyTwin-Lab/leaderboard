import { beforeEach, describe, expect, it, vi } from "vitest";

import type { LabMember } from "@/lib/server/labMember";

const submitLabJoin = vi.fn();
vi.mock("@/lib/server/crm", () => ({ submitLabJoin }));

// Le cookie du membre, tenu en mémoire : ce que le navigateur renverrait.
let cookie: LabMember | null = null;
vi.mock("@/lib/server/labMember", () => ({
  readLabMember: async () => cookie,
  writeLabMember: async (member: LabMember) => {
    cookie = member;
  },
}));

const { joinLab } = await import("./actions");

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

beforeEach(() => {
  submitLabJoin.mockReset();
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
    expect(cookie).toEqual({ email: "ada@example.com" });
  });

  it("sends « other » when no role, or an unknown one, is given", async () => {
    submitLabJoin.mockResolvedValue({ submissionUuid: "sub-1", isFirstOfKind: true });

    await joinLab(form({ email: "ada@example.com" }));
    await joinLab(form({ email: "ada@example.com", role: "admin" }));

    expect(submitLabJoin.mock.calls.map(([request]) => request.role)).toEqual(["other", "other"]);
  });

  it("tells a returning member apart", async () => {
    submitLabJoin.mockResolvedValue({ submissionUuid: "sub-2", isFirstOfKind: false });

    expect(await joinLab(form({ email: "ada@example.com" }))).toEqual({ returning: true });
  });

  it("remembers the last email joined on this browser", async () => {
    cookie = { email: "ada@example.com" };
    submitLabJoin.mockResolvedValue({ submissionUuid: "sub-3", isFirstOfKind: true });

    await joinLab(form({ email: "grace@example.com" }));

    expect(cookie).toEqual({ email: "grace@example.com" });
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
