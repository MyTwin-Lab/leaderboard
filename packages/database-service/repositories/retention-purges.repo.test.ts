import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests des écritures des repositories touchés par les correctifs de
 * conservation (L9, M9), sans base : `db` est une chaîne factice qui enregistre
 * ce qui lui est passé, et les opérateurs drizzle rendent des descripteurs
 * lisibles. On vérifie la forme exacte des UPDATE — quelles colonnes sont
 * écrites, et surtout lesquelles ne le sont pas.
 */

const h = vi.hoisted(() => {
  const calls: { op: string; method: string; args: unknown[] }[] = [];

  function chain(op: string, result: unknown[] = []) {
    const target: Record<string, unknown> = {};
    for (const method of ["set", "where", "from", "innerJoin", "leftJoin", "values", "returning", "orderBy"]) {
      target[method] = (...args: unknown[]) => {
        calls.push({ op, method, args });
        return target;
      };
    }
    target.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject);
    return target;
  }

  const table = (name: string) =>
    new Proxy({ __table: name } as Record<string, unknown>, {
      get: (obj, prop) => (prop in obj ? obj[prop as string] : `${name}.${String(prop)}`),
    });

  return {
    calls,
    returning: [] as unknown[],
    db: {
      update: (t: { __table: string }) => {
        calls.push({ op: "update", method: "table", args: [t.__table] });
        return chain("update", h.returning);
      },
      select: (cols?: unknown) => {
        calls.push({ op: "select", method: "columns", args: [cols] });
        return chain("select");
      },
    },
    table,
  };
});

vi.mock("../db/drizzle", () => ({
  db: h.db,
  challenges: h.table("challenges"),
  validation_reference_cases: h.table("validation_reference_cases"),
  validation_case_claims: h.table("validation_case_claims"),
  compute_requests: h.table("compute_requests"),
}));
vi.mock("../db/mappers", () => ({
  toDomainComputeRequest: (row: unknown) => row,
  toDomainValidationCaseClaim: (row: unknown) => row,
  toDomainValidationReferenceCase: (row: unknown) => row,
}));
vi.mock("../domain/schemas_zod", () => ({}));
vi.mock("drizzle-orm", () => ({
  eq: (a: unknown, b: unknown) => ({ eq: [a, b] }),
  ne: (a: unknown, b: unknown) => ({ ne: [a, b] }),
  lt: (a: unknown, b: unknown) => ({ lt: [a, b] }),
  lte: (a: unknown, b: unknown) => ({ lte: [a, b] }),
  and: (...conds: unknown[]) => ({ and: conds }),
  isNull: (a: unknown) => ({ isNull: a }),
  isNotNull: (a: unknown) => ({ isNotNull: a }),
  inArray: (a: unknown, b: unknown) => ({ inArray: [a, b] }),
  count: () => ({ count: true }),
  sql: (strings: TemplateStringsArray) => ({ sql: strings.join("?") }),
}));

import { ReferenceCaseRepository } from "./referenceCase.repo";
import { CaseClaimRepository } from "./caseClaim.repo";
import { ComputeRequestRepository } from "./computeRequest.repo";

function setCall() {
  const call = h.calls.find((c) => c.op === "update" && c.method === "set");
  return call?.args[0] as Record<string, unknown>;
}

function whereOfUpdate() {
  return h.calls.find((c) => c.op === "update" && c.method === "where")?.args[0];
}

beforeEach(() => {
  h.calls.length = 0;
  h.returning = [];
});

const CUTOFF = new Date("2025-09-14T00:00:00.000Z");

describe("ReferenceCaseRepository.purgeBytesForChallengesClosedBefore", () => {
  it("vide seulement les deux blobs et pose purged_at", async () => {
    h.returning = [{ uuid: "case-1" }, { uuid: "case-2" }];

    const purged = await new ReferenceCaseRepository().purgeBytesForChallengesClosedBefore(CUTOFF);

    expect(purged).toBe(2);
    const set = setCall();
    expect(Object.keys(set).sort()).toEqual(["expected_output_bytes", "input_bytes", "purged_at"]);
    expect(set.input_bytes).toEqual({ sql: "''::bytea" });
    expect(set.expected_output_bytes).toEqual({ sql: "''::bytea" });
    expect(set.purged_at).toBeInstanceOf(Date);
  });

  it("ne vise que les challenges de validation fermés avant la date, pas encore purgés", async () => {
    await new ReferenceCaseRepository().purgeBytesForChallengesClosedBefore(CUTOFF);

    expect(whereOfUpdate()).toMatchObject({
      and: [
        { isNull: "validation_reference_cases.purged_at" },
        { inArray: ["validation_reference_cases.validation_challenge_id", expect.anything()] },
      ],
    });
    const subqueryWhere = h.calls.find((c) => c.op === "select" && c.method === "where")?.args[0];
    expect(subqueryWhere).toEqual({
      and: [
        { isNotNull: "challenges.source_challenge_id" },
        { isNotNull: "challenges.closed_at" },
        { lt: ["challenges.closed_at", CUTOFF] },
      ],
    });
  });
});

describe("CaseClaimRepository.purgeBytesForChallengesClosedBefore", () => {
  it("vide response_bytes et pose purged_at — observation, statut, verdicts intacts", async () => {
    h.returning = [{ uuid: "claim-1" }];

    const purged = await new CaseClaimRepository().purgeBytesForChallengesClosedBefore(CUTOFF);

    expect(purged).toBe(1);
    const set = setCall();
    expect(Object.keys(set).sort()).toEqual(["purged_at", "response_bytes"]);
    expect(set.response_bytes).toEqual({ sql: "''::bytea" });
    // Aucune écriture hors de validation_case_claims : ni validation_attempts
    // (verdicts), ni reward_entries (CP).
    const updatedTables = h.calls.filter((c) => c.op === "update" && c.method === "table").map((c) => c.args[0]);
    expect(updatedTables).toEqual(["validation_case_claims"]);
  });
});

describe("ComputeRequestRepository — jeton Jupyter", () => {
  it("updateExpired vide access_token_enc et access_token_iv", async () => {
    await new ComputeRequestRepository().updateExpired("req-1", "timeout");

    expect(setCall()).toMatchObject({
      status: "expired",
      expire_reason: "timeout",
      access_token_enc: null,
      access_token_iv: null,
    });
  });

  it("updateFailed vide access_token_enc et access_token_iv", async () => {
    await new ComputeRequestRepository().updateFailed("req-1", "boom");

    expect(setCall()).toMatchObject({
      status: "failed",
      error_message: "boom",
      access_token_enc: null,
      access_token_iv: null,
    });
  });

  it("findExpiredPending balaie approved, provisioning et ready", async () => {
    const now = new Date("2026-09-14T00:00:00.000Z");
    await new ComputeRequestRepository().findExpiredPending(now);

    const where = h.calls.find((c) => c.op === "select" && c.method === "where")?.args[0];
    expect(where).toEqual({
      and: [
        { inArray: ["compute_requests.status", ["approved", "provisioning", "ready"]] },
        { lte: ["compute_requests.expires_at", now] },
      ],
    });
  });
});
