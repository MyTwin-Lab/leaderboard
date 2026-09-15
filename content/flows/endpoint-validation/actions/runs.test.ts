import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  contributionRepo: { findById: vi.fn() },
  attemptRepo: { findByChallenge: vi.fn(), findById: vi.fn() },
  userRepo: { findByIds: vi.fn() },
  caseClaimRepo: { findById: vi.fn(), findPurgeState: vi.fn() },
  referenceCaseRepo: { findInputById: vi.fn() },
}));

vi.mock("../../../../packages/database-service/repositories/index.js", () => ({
  ContributionRepository: class { constructor() { return h.contributionRepo; } },
  ValidationAttemptRepository: class { constructor() { return h.attemptRepo; } },
  UserRepository: class { constructor() { return h.userRepo; } },
  CaseClaimRepository: class { constructor() { return h.caseClaimRepo; } },
  ReferenceCaseRepository: class { constructor() { return h.referenceCaseRepo; } },
}));

import { actionContext } from "../../../../packages/capabilities/testing/action-context.js";
import { endpointValidationActions } from "./index.js";
import { listRuns, runFile, runResponse } from "./runs.js";

const CHALLENGE_ID = "challenge-1";
const CLAIM_ID = "claim-1";

const ctx = (params: Record<string, string> = {}) =>
  actionContext({ challenge: { uuid: CHALLENGE_ID, type: "endpoint-validation" }, user: { id: "admin-1", role: "admin" }, params });

const file = () => runFile(ctx({ attemptId: "attempt-1" }));
const response = () => runResponse(ctx({ attemptId: "attempt-1" }));

async function statusOf(result: unknown): Promise<number> {
  return result instanceof Response ? result.status : 200;
}

beforeEach(() => {
  vi.clearAllMocks();
  h.attemptRepo.findByChallenge.mockResolvedValue([]);
  h.userRepo.findByIds.mockResolvedValue([]);
});

describe("runs — declared access", () => {
  it.each(["runs", "runs/:attemptId/file", "runs/:attemptId/response"])("keeps GET %s to an admin or the challenge's manager", (path) => {
    const access = endpointValidationActions.find((a) => a.method === "GET" && a.path === path)?.access;

    expect(access).toEqual({ roles: ["admin"], manager: true });
  });
});

describe("GET runs", () => {
  const attempt = (over: Record<string, unknown>) => ({
    uuid: "attempt-1",
    contribution_id: "contrib-1",
    validator_user_id: "validator-1",
    verdict: "works",
    description: null,
    created_at: new Date("2026-01-01T00:00:00Z"),
    file_filename: "cat.png",
    file_content_type: "image/png",
    response_content_type: "application/json",
    response_status: 200,
    purged_at: null,
    ...over,
  });

  it("maps runs with resolved submitter/validator names, description, and purged flag", async () => {
    h.attemptRepo.findByChallenge.mockResolvedValue([
      attempt({ verdict: "broken", description: "It crashed", response_status: 500 }),
      attempt({ uuid: "attempt-2", validator_user_id: "validator-2", purged_at: new Date("2026-02-01T00:00:00Z") }),
    ]);
    h.contributionRepo.findById.mockResolvedValue({ uuid: "contrib-1", user_id: "submitter-1" });
    h.userRepo.findByIds.mockResolvedValue([
      { uuid: "submitter-1", full_name: "Alice" },
      { uuid: "validator-1", full_name: "Bob" },
      { uuid: "validator-2", full_name: "Carol" },
    ]);

    const { runs } = (await listRuns(ctx())) as { runs: any[] };

    expect(h.attemptRepo.findByChallenge).toHaveBeenCalledWith(CHALLENGE_ID);
    expect(runs).toHaveLength(2);
    expect(runs[0]).toMatchObject({ submitterName: "Alice", validatorName: "Bob", verdict: "broken", description: "It crashed", purged: false });
    expect(runs[1]).toMatchObject({ submitterName: "Alice", validatorName: "Carol", verdict: "works", description: null, purged: true });
  });

  it("never includes file_bytes/response_bytes fields in the response (list is metadata-only)", async () => {
    h.attemptRepo.findByChallenge.mockResolvedValue([attempt({ file_bytes: Buffer.from("x"), response_bytes: Buffer.from("y") })]);
    h.contributionRepo.findById.mockResolvedValue({ uuid: "contrib-1", user_id: "submitter-1" });

    const { runs } = (await listRuns(ctx())) as { runs: any[] };

    expect(JSON.stringify(runs[0])).not.toMatch(/bytes/i);
  });
});

describe("GET runs/:attemptId/file", () => {
  it("returns 404 when the run does not exist", async () => {
    h.attemptRepo.findById.mockResolvedValue(null);
    expect(await statusOf(await file())).toBe(404);
  });

  it("returns 404 when the run belongs to a different challenge", async () => {
    h.attemptRepo.findById.mockResolvedValue({ validation_challenge_id: "other-challenge", file_bytes: Buffer.from("x") });
    expect(await statusOf(await file())).toBe(404);
  });

  it("returns 410 when the file was purged (file_bytes is null)", async () => {
    h.attemptRepo.findById.mockResolvedValue({ validation_challenge_id: CHALLENGE_ID, file_bytes: null });
    expect(await statusOf(await file())).toBe(410);
  });

  it("streams the file bytes with hardened headers — inline for an allowlisted image", async () => {
    h.attemptRepo.findById.mockResolvedValue({
      validation_challenge_id: CHALLENGE_ID, file_bytes: Buffer.from("fake-png-bytes"), file_content_type: "image/png", file_filename: "cat.png",
    });

    const res = (await file()) as Response;

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("content-disposition")).toMatch(/^inline;/);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(Buffer.from(await res.arrayBuffer()).toString()).toBe("fake-png-bytes");
  });

  it("forces attachment for a non-allowlisted content type (e.g. an uploaded HTML file)", async () => {
    h.attemptRepo.findById.mockResolvedValue({
      validation_challenge_id: CHALLENGE_ID, file_bytes: Buffer.from("<script>alert(1)</script>"), file_content_type: "text/html", file_filename: "exploit.html",
    });

    expect(((await file()) as Response).headers.get("content-disposition")).toMatch(/^attachment;/);
  });

  describe("claim-backed run (reference_case_claim_id set)", () => {
    beforeEach(() => {
      h.attemptRepo.findById.mockResolvedValue({ validation_challenge_id: CHALLENGE_ID, reference_case_claim_id: CLAIM_ID, file_bytes: null });
    });

    it("returns 410 without loading any blob once the reference case bytes were purged", async () => {
      h.caseClaimRepo.findPurgeState.mockResolvedValue({ validator_user_id: "v1", claim_purged_at: new Date("2026-01-01"), case_purged_at: new Date("2026-01-01") });

      expect(await statusOf(await file())).toBe(410);
      expect(h.caseClaimRepo.findPurgeState).toHaveBeenCalledWith(CLAIM_ID);
      expect(h.caseClaimRepo.findById).not.toHaveBeenCalled();
      expect(h.referenceCaseRepo.findInputById).not.toHaveBeenCalled();
    });

    it("returns 410 when the claim no longer exists", async () => {
      h.caseClaimRepo.findPurgeState.mockResolvedValue(null);

      expect(await statusOf(await file())).toBe(410);
      expect(h.referenceCaseRepo.findInputById).not.toHaveBeenCalled();
    });

    it("streams the reference case input bytes when not purged", async () => {
      h.caseClaimRepo.findPurgeState.mockResolvedValue({ validator_user_id: "v1", claim_purged_at: null, case_purged_at: null });
      h.caseClaimRepo.findById.mockResolvedValue({ reference_case_id: "case-1" });
      h.referenceCaseRepo.findInputById.mockResolvedValue({ input_bytes: Buffer.from("input"), input_content_type: "image/png", input_filename: "in.png" });

      const res = (await file()) as Response;

      expect(res.status).toBe(200);
      expect(h.referenceCaseRepo.findInputById).toHaveBeenCalledWith("case-1");
      expect(Buffer.from(await res.arrayBuffer()).toString()).toBe("input");
    });
  });
});

describe("GET runs/:attemptId/response", () => {
  it("returns 404 when the run belongs to a different challenge", async () => {
    h.attemptRepo.findById.mockResolvedValue({ validation_challenge_id: "other-challenge", response_bytes: Buffer.from("x") });
    expect(await statusOf(await response())).toBe(404);
  });

  it("returns 410 when the response was purged (response_bytes is null)", async () => {
    h.attemptRepo.findById.mockResolvedValue({ validation_challenge_id: CHALLENGE_ID, response_bytes: null });
    expect(await statusOf(await response())).toBe(410);
  });

  it("streams the response bytes with hardened headers and echoes the original HTTP status", async () => {
    h.attemptRepo.findById.mockResolvedValue({
      validation_challenge_id: CHALLENGE_ID, response_bytes: Buffer.from('{"label":"cat"}'), response_content_type: "application/json", response_status: 500,
    });

    const res = (await response()) as Response;

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/json");
    // JSON n'est pas dans la liste des images sûres : jamais rendu en ligne.
    expect(res.headers.get("content-disposition")).toMatch(/^attachment;/);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("x-validation-status")).toBe("500");
    expect(Buffer.from(await res.arrayBuffer()).toString()).toBe('{"label":"cat"}');
  });

  it("omits X-Validation-Status when response_status is null", async () => {
    h.attemptRepo.findById.mockResolvedValue({
      validation_challenge_id: CHALLENGE_ID, response_bytes: Buffer.from("hi"), response_content_type: "text/plain", response_status: null,
    });

    expect(((await response()) as Response).headers.get("x-validation-status")).toBeNull();
  });

  it("never renders a validated endpoint response inline, even if it claims to be an image/svg+xml", async () => {
    h.attemptRepo.findById.mockResolvedValue({
      validation_challenge_id: CHALLENGE_ID, response_bytes: Buffer.from('<svg onload="alert(1)"></svg>'), response_content_type: "image/svg+xml", response_status: 200,
    });

    expect(((await response()) as Response).headers.get("content-disposition")).toMatch(/^attachment;/);
  });

  describe("claim-backed run (reference_case_claim_id set)", () => {
    beforeEach(() => {
      h.attemptRepo.findById.mockResolvedValue({ validation_challenge_id: CHALLENGE_ID, reference_case_claim_id: CLAIM_ID, response_bytes: null });
    });

    it("returns 410 without loading the blob once the claim bytes were purged", async () => {
      h.caseClaimRepo.findPurgeState.mockResolvedValue({ validator_user_id: "v1", claim_purged_at: new Date("2026-01-01"), case_purged_at: new Date("2026-01-01") });

      expect(await statusOf(await response())).toBe(410);
      expect(h.caseClaimRepo.findById).not.toHaveBeenCalled();
    });

    it("returns 410 when the claim no longer exists", async () => {
      h.caseClaimRepo.findPurgeState.mockResolvedValue(null);

      expect(await statusOf(await response())).toBe(410);
      expect(h.caseClaimRepo.findById).not.toHaveBeenCalled();
    });

    it("streams the claim response bytes when not purged", async () => {
      h.caseClaimRepo.findPurgeState.mockResolvedValue({ validator_user_id: "v1", claim_purged_at: null, case_purged_at: null });
      h.caseClaimRepo.findById.mockResolvedValue({ response_bytes: Buffer.from("ok"), response_content_type: "text/plain", response_status: 200 });

      const res = (await response()) as Response;

      expect(res.status).toBe(200);
      expect(res.headers.get("x-validation-status")).toBe("200");
      expect(Buffer.from(await res.arrayBuffer()).toString()).toBe("ok");
    });
  });
});
