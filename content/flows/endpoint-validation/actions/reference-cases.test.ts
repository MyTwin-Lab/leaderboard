import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  caseRepo: { findByChallenge: vi.fn(), findByAuthor: vi.fn(), findInputById: vi.fn(), delete: vi.fn() },
  caseClaimRepo: { findByReferenceCase: vi.fn() },
  service: { authorCase: vi.fn() },
  errors: {
    InsufficientRoleError: class extends Error {},
    ReferenceCaseQuotaError: class extends Error {},
    ValidationTargetError: class extends Error {},
  },
}));

vi.mock("../../../../packages/database-service/repositories/index.js", () => ({
  ReferenceCaseRepository: class { constructor() { return h.caseRepo; } },
  CaseClaimRepository: class { constructor() { return h.caseClaimRepo; } },
}));

vi.mock("../../../../packages/services/challenge/reference-case.service.js", () => ({
  ReferenceCaseService: class { constructor() { return h.service; } },
  ...h.errors,
}));

import { actionContext, type ActionContextOptions } from "../../../../packages/capabilities/testing/action-context.js";
import { endpointValidationActions } from "./index.js";
import { authorReferenceCase, listReferenceCases, referenceCaseInput, removeReferenceCase } from "./reference-cases.js";

const CHALLENGE = {
  uuid: "challenge-1", type: "endpoint-validation",
  flow_config: { cp_per_validation: 5, required_validations: 3, reviewer_qualification: "medical_pro" },
};

const ctx = (options: ActionContextOptions = {}) =>
  actionContext({ challenge: CHALLENGE, user: { id: "bob", role: "contributor" }, ...options });

async function read(result: unknown): Promise<{ status: number; body: any }> {
  if (result instanceof Response) return { status: result.status, body: await result.json() };
  return { status: 200, body: result };
}

function uploadForm() {
  const form = new FormData();
  form.append("input", new File([Buffer.from("in")], "in.png", { type: "image/png" }));
  form.append("expected_output", new File([Buffer.from("out")], "out.txt", { type: "text/plain" }));
  return form;
}

const CASE = {
  uuid: "case-1",
  validation_challenge_id: "challenge-1",
  author_user_id: "bob",
  input_bytes: Buffer.from("<svg onload=alert(1)>"),
  input_filename: "x.svg",
  input_content_type: "image/svg+xml",
  purged_at: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  h.caseRepo.findByChallenge.mockResolvedValue([]);
  h.caseRepo.findByAuthor.mockResolvedValue([]);
  h.caseRepo.findInputById.mockResolvedValue(CASE);
  h.caseRepo.delete.mockResolvedValue(undefined);
  h.caseClaimRepo.findByReferenceCase.mockResolvedValue([]);
});

describe("reference cases — declared access", () => {
  const access = (method: string, path: string) =>
    endpointValidationActions.find((a) => a.method === method && a.path === path)?.access;

  it("lets an admin, the manager or a qualified reviewer list the cases", () => {
    const listing = access("GET", "reference-cases");

    expect(listing).toMatchObject({ roles: ["admin"], manager: true });
    expect(listing?.qualification?.(CHALLENGE as never)).toBe("medical_pro");
  });

  it("keeps authoring to qualified reviewers, with no admin or manager override", () => {
    const authoring = access("POST", "reference-cases");

    expect(Object.keys(authoring ?? {})).toEqual(["qualification"]);
    expect(authoring?.qualification?.(CHALLENGE as never)).toBe("medical_pro");
  });

  it("leaves removing a case and reading its input to the handler, which knows the author", () => {
    expect(access("DELETE", "reference-cases/:caseId")).toEqual({});
    expect(access("GET", "reference-cases/:caseId/input")).toEqual({});
  });
});

describe("GET reference-cases", () => {
  const summary = { uuid: "case-1", author_user_id: "bob", input_filename: "a.png", input_content_type: "image/png", created_at: new Date("2026-01-01") };

  it("returns the full list for an admin", async () => {
    h.caseRepo.findByChallenge.mockResolvedValue([summary]);

    const { body } = await read(await listReferenceCases(ctx({ user: { id: "admin-1", role: "admin" } })));

    expect(h.caseRepo.findByChallenge).toHaveBeenCalledWith("challenge-1");
    expect(body.cases).toEqual([
      { id: "case-1", authorUserId: "bob", inputFilename: "a.png", inputContentType: "image/png", createdAt: summary.created_at },
    ]);
  });

  it("returns the full list for the challenge's manager", async () => {
    await listReferenceCases(ctx({ access: { manager: true } }));

    expect(h.caseRepo.findByChallenge).toHaveBeenCalled();
    expect(h.caseRepo.findByAuthor).not.toHaveBeenCalled();
  });

  it("returns only the caller's own cases for a qualified reviewer", async () => {
    await listReferenceCases(ctx({ access: { qualifications: ["medical_pro"] } }));

    expect(h.caseRepo.findByAuthor).toHaveBeenCalledWith("challenge-1", "bob");
    expect(h.caseRepo.findByChallenge).not.toHaveBeenCalled();
  });
});

describe("POST reference-cases", () => {
  const author = (form: FormData = uploadForm()) => authorReferenceCase(ctx({ method: "POST", body: form }));

  it("authors a case as a qualified reviewer", async () => {
    h.service.authorCase.mockResolvedValue({
      uuid: "case-1", author_user_id: "bob", input_filename: "in.png", input_content_type: "image/png", created_at: new Date(),
    });

    const { status, body } = await read(await author());

    expect(status).toBe(201);
    expect(body).toMatchObject({ id: "case-1", authorUserId: "bob", inputFilename: "in.png" });
    const input = h.service.authorCase.mock.calls[0][0];
    expect(input).toMatchObject({ validationChallengeId: "challenge-1", authorUserId: "bob" });
    expect(input.input).toMatchObject({ filename: "in.png", contentType: "image/png" });
    expect(input.expectedOutput).toMatchObject({ filename: "out.txt", contentType: "text/plain" });
  });

  it("returns 400 when the input file is missing", async () => {
    const form = new FormData();
    form.append("expected_output", new File([Buffer.from("out")], "out.txt", { type: "text/plain" }));

    expect((await read(await author(form))).status).toBe(400);
    expect(h.service.authorCase).not.toHaveBeenCalled();
  });

  it.each([
    ["InsufficientRoleError", 403],
    ["ReferenceCaseQuotaError", 409],
    ["ValidationTargetError", 400],
  ] as const)("maps %s to %i", async (name, status) => {
    h.service.authorCase.mockRejectedValue(new h.errors[name]("refused"));

    expect((await read(await author())).status).toBe(status);
  });
});

describe("DELETE reference-cases/:caseId", () => {
  const remove = (options: ActionContextOptions = {}) => removeReferenceCase(ctx({ method: "DELETE", params: { caseId: "case-1" }, ...options }));

  it("lets the author remove their own unclaimed case", async () => {
    expect(await remove()).toEqual({ success: true });
    expect(h.caseRepo.delete).toHaveBeenCalledWith("case-1");
  });

  it("lets an admin remove any unclaimed case", async () => {
    h.caseRepo.findInputById.mockResolvedValue({ ...CASE, author_user_id: "someone-else" });

    expect(await remove({ user: { id: "admin-1", role: "admin" } })).toEqual({ success: true });
  });

  it("returns 403 for a different reviewer, even the manager", async () => {
    const res = await read(await remove({ user: { id: "other-reviewer", role: "contributor" }, access: { manager: true } }));

    expect(res.status).toBe(403);
    expect(h.caseRepo.delete).not.toHaveBeenCalled();
  });

  it("returns 409 once the case already has a claim", async () => {
    h.caseClaimRepo.findByReferenceCase.mockResolvedValue([{ uuid: "claim-1" }]);

    expect((await read(await remove())).status).toBe(409);
    expect(h.caseRepo.delete).not.toHaveBeenCalled();
  });

  it("returns 404 when the case does not belong to this challenge", async () => {
    h.caseRepo.findInputById.mockResolvedValue({ ...CASE, validation_challenge_id: "other-challenge" });

    expect((await read(await remove())).status).toBe(404);
  });
});

describe("GET reference-cases/:caseId/input", () => {
  const input = (options: ActionContextOptions = {}) => referenceCaseInput(ctx({ params: { caseId: "case-1" }, ...options }));

  it("serves the author's bytes with nosniff, never inline for an SVG", async () => {
    const res = (await input()) as Response;

    expect(res.status).toBe(200);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("content-disposition")).toMatch(/^attachment;/);
    expect(await res.text()).toBe("<svg onload=alert(1)>");
  });

  it("serves them to the challenge's manager", async () => {
    expect(((await input({ user: { id: "manager-1" }, access: { manager: true } })) as Response).status).toBe(200);
  });

  it("returns 410 once the retention purge has run", async () => {
    h.caseRepo.findInputById.mockResolvedValue({ ...CASE, input_bytes: Buffer.alloc(0), purged_at: new Date() });

    expect((await read(await input())).status).toBe(410);
  });

  it("keeps the 403 before the 410: the purge tells nothing to someone without access", async () => {
    h.caseRepo.findInputById.mockResolvedValue({ ...CASE, purged_at: new Date() });

    expect((await read(await input({ user: { id: "mallory" } }))).status).toBe(403);
  });
});
