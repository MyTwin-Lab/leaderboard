import { describe, it, expect, vi } from "vitest";
import {
  SandboxEvaluationService,
  buildEvaluationContext,
} from "./sandbox-evaluation.service.js";
import type { Sandbox } from "../../database-service/domain/entities.js";
import type { ProposableDeclaration } from "../../registry/platform.js";
import { codeProposable } from "../../../content/flows/code/proposable.js";
import { mlProposable } from "../../../content/flows/ml/proposable.js";

const SB = "sb-1";
const ALICE = "alice";
const EVENT = { sandboxId: SB, userId: ALICE };

/** Les flows proposables de la distribution MyTwin, sans installer le registre. */
const PROPOSABLE: Record<string, ProposableDeclaration> = { code: codeProposable, ml: mlProposable };

function makeSandbox(over: Partial<Sandbox> = {}): Sandbox {
  return {
    uuid: SB,
    user_id: ALICE,
    type: "code",
    title: "Widget",
    slug: "widget",
    context: "A small widget",
    goals: ["ship it"],
    why: "it matters",
    repo_url: "https://github.com/acme/widget",
    model_url: null,
    dataset_urls: [],
    status: "open",
    promoted_challenge_id: null,
    promoted_at: null,
    evaluation: null,
    evaluation_status: null,
    evaluated_at: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...over,
  };
}

/**
 * Le repository est à état : `setEvaluationStatus` rejoue le compare-and-set
 * (`expectedFrom`) sur le sandbox courant, pour que claim puis run voient ce
 * que la base leur montrerait.
 *
 * Les repositories de reward sont montés **exprès** : ils n'y ont rien à
 * faire, et le test vérifie qu'aucune de leurs méthodes n'est appelée. Une
 * évaluation formative ne paie pas de CP.
 */
function makeDeps(opts: { sandbox?: Partial<Sandbox> | null; claim?: boolean; fails?: boolean } = {}) {
  let current: Sandbox | null = opts.sandbox === null ? null : makeSandbox(opts.sandbox ?? {});
  const stored: Array<{ evaluation: unknown; status: string }> = [];
  const transitions: Array<{ status: string; expectedFrom?: unknown }> = [];

  const sandboxRepo = {
    findById: vi.fn(async () => (current ? { ...current } : null)),
    setEvaluationStatus: vi.fn(async (_uuid: string, status: string, o?: { expectedFrom?: unknown }) => {
      transitions.push({ status, expectedFrom: o?.expectedFrom });
      if (!current) return false;
      // `claim: false` simule un autre appel qui a basculé le statut entre la
      // lecture et le compare-and-set.
      if (status === "running" && opts.claim === false) return false;
      if (o?.expectedFrom !== undefined && current.evaluation_status !== o.expectedFrom) return false;
      current = { ...current, evaluation_status: status as Sandbox["evaluation_status"] };
      return true;
    }),
    storeEvaluation: vi.fn(async (_uuid: string, evaluation: unknown, status = "done") => {
      stored.push({ evaluation, status });
      return makeSandbox();
    }),
  };

  const evaluate = vi.fn(async (_request: any) => {
    if (opts.fails) throw new Error("agent down");
    return { runId: "run-1", evaluation: { globalScore: 7.2, scores: [] }, refs: ["abc"] };
  });

  // Les repositories de reward : jamais touchés, et c'est ce qu'on vérifie.
  const rewardRepo = {
    insertTierIfAbsent: vi.fn(),
    paidTierThresholdsBySandboxIds: vi.fn(),
    findBySandbox: vi.fn(),
  };
  const contributionRepo = { create: vi.fn(), update: vi.fn() };

  const service = new SandboxEvaluationService({
    sandboxRepo,
    evaluate,
    proposable: (flowKey) => PROPOSABLE[flowKey],
  } as any);
  return { service, sandboxRepo, evaluate, rewardRepo, contributionRepo, stored, transitions };
}

describe("buildEvaluationContext", () => {
  it("compose le contexte et le pourquoi", () => {
    const text = buildEvaluationContext(makeSandbox());
    expect(text).toContain("A small widget");
    expect(text).toContain("Why it matters: it matters");
  });

  it("liste les buts, contre lesquels le dépôt est jugé", () => {
    const text = buildEvaluationContext(
      makeSandbox({ goals: ["Ship a reproducible pipeline", "Score one recording"] }),
    );
    expect(text).toContain("What the author set out to build:");
    expect(text).toContain("- Ship a reproducible pipeline");
    expect(text).toContain("- Score one recording");
  });

  it("sans but, aucune section correspondante", () => {
    const text = buildEvaluationContext(makeSandbox({ goals: [] }));
    expect(text).not.toContain("What the author set out to build");
  });

  it("ajoute en dernier les lignes que le flow tire des champs", () => {
    const text = buildEvaluationContext(makeSandbox(), ["Datasets: https://kaggle.com/d/one"]);
    expect(text.endsWith("Datasets: https://kaggle.com/d/one")).toBe(true);
  });
});

describe("SandboxEvaluationService.canEvaluate", () => {
  it("accepte l'auteur", async () => {
    const { service } = makeDeps();
    expect(await service.canEvaluate(SB, ALICE)).toEqual({ ok: true });
  });

  it("refuse quelqu'un d'autre", async () => {
    const { service } = makeDeps();
    expect(await service.canEvaluate(SB, "bob")).toEqual({ ok: false, reason: "not_author" });
  });

  it("refuse un sandbox inconnu", async () => {
    const { service } = makeDeps({ sandbox: null });
    expect(await service.canEvaluate(SB, ALICE)).toEqual({ ok: false, reason: "not_found" });
  });

  it("refuse des champs dont le flow ne tire aucune entrée", async () => {
    const { service } = makeDeps({ sandbox: { repo_url: "https://gitlab.com/acme/widget" } });
    expect(await service.canEvaluate(SB, ALICE)).toEqual({ ok: false, reason: "invalid_fields" });
  });

  it("lit les champs du jsonb avant les anciennes colonnes", async () => {
    const { service } = makeDeps({
      sandbox: { repo_url: "https://github.com/acme/widget", proposal_fields: { repo_url: "https://gitlab.com/x/y" } },
    });
    expect(await service.canEvaluate(SB, ALICE)).toEqual({ ok: false, reason: "invalid_fields" });
  });

  it("refuse un sandbox dont le flow n'évalue plus de propositions", async () => {
    const { service } = makeDeps({ sandbox: { type: "journey-validation" } });
    expect(await service.canEvaluate(SB, ALICE)).toEqual({ ok: false, reason: "not_evaluable" });
  });

  it("refuse tant qu'un run est en vol", async () => {
    const { service } = makeDeps({ sandbox: { evaluation_status: "running" } });
    expect(await service.canEvaluate(SB, ALICE)).toEqual({ ok: false, reason: "already_running" });
  });
});

describe("SandboxEvaluationService.claim", () => {
  it("bascule en running par compare-and-set, sans lancer l'agent", async () => {
    const { service, transitions, evaluate } = makeDeps();

    expect(await service.claim(EVENT)).toEqual({ ok: true });

    expect(transitions).toEqual([{ status: "running", expectedFrom: null }]);
    expect(evaluate).not.toHaveBeenCalled();
  });

  it("un second claim pendant le run reçoit already_running", async () => {
    const { service, transitions } = makeDeps();

    expect(await service.claim(EVENT)).toEqual({ ok: true });
    expect(await service.claim(EVENT)).toEqual({ ok: false, reason: "already_running" });

    expect(transitions).toHaveLength(1);
  });

  it("reprend depuis le dernier statut connu", async () => {
    const { service, transitions } = makeDeps({ sandbox: { evaluation_status: "done" } });

    expect(await service.claim(EVENT)).toEqual({ ok: true });
    expect(transitions).toEqual([{ status: "running", expectedFrom: "done" }]);
  });

  it("répond already_running quand un autre appel a pris la main entre la lecture et la bascule", async () => {
    const { service, transitions } = makeDeps({ claim: false });

    expect(await service.claim(EVENT)).toEqual({ ok: false, reason: "already_running" });
    // La bascule a été tentée, le compare-and-set l'a refusée.
    expect(transitions).toEqual([{ status: "running", expectedFrom: null }]);
  });

  it.each([
    [{ sandbox: null }, ALICE, "not_found"],
    [{}, "bob", "not_author"],
    [{ sandbox: { repo_url: "https://gitlab.com/acme/widget" } }, ALICE, "invalid_fields"],
    [{ sandbox: { type: "unknown" } }, ALICE, "not_evaluable"],
    [{ sandbox: { evaluation_status: "pending" as const } }, ALICE, "already_running"],
  ] as const)("refuse sans rien écrire (%#)", async (opts, userId, reason) => {
    const { service, transitions } = makeDeps(opts as any);

    expect(await service.claim({ sandboxId: SB, userId })).toEqual({ ok: false, reason });
    expect(transitions).toHaveLength(0);
  });
});

describe("SandboxEvaluationService.run", () => {
  it("n'évalue rien sans claim préalable", async () => {
    const { service, evaluate, transitions } = makeDeps();

    await service.run(EVENT);

    expect(evaluate).not.toHaveBeenCalled();
    expect(transitions).toHaveLength(0);
  });

  it("n'évalue rien pour qui n'est pas l'auteur", async () => {
    const { service, evaluate, transitions } = makeDeps({ sandbox: { evaluation_status: "running" } });

    await service.run({ sandboxId: SB, userId: "bob" });

    expect(evaluate).not.toHaveBeenCalled();
    expect(transitions).toHaveLength(0);
  });

  it("passe à failed si les champs ne donnent plus d'entrée", async () => {
    const { service, evaluate, transitions } = makeDeps({
      sandbox: { evaluation_status: "running", repo_url: "https://gitlab.com/acme/widget" },
    });

    await expect(service.run(EVENT)).rejects.toThrow("Unusable proposal fields");

    expect(evaluate).not.toHaveBeenCalled();
    expect(transitions).toEqual([{ status: "failed", expectedFrom: undefined }]);
  });

  it("passe à failed si le flow a été retiré depuis le claim", async () => {
    const { service, evaluate, transitions } = makeDeps({
      sandbox: { evaluation_status: "running", type: "retired" },
    });

    await expect(service.run(EVENT)).rejects.toThrow('Flow "retired" does not evaluate proposals');

    expect(evaluate).not.toHaveBeenCalled();
    expect(transitions).toEqual([{ status: "failed", expectedFrom: undefined }]);
  });
});

describe("SandboxEvaluationService.evaluate", () => {
  it("évalue avec la source et la grille déclarées par le flow, puis stocke en done", async () => {
    const { service, evaluate, transitions, stored, rewardRepo, contributionRepo } = makeDeps();

    await service.evaluate(EVENT);

    expect(transitions).toEqual([{ status: "running", expectedFrom: null }]);
    expect(stored).toEqual([{ evaluation: { globalScore: 7.2, scores: [] }, status: "done" }]);

    expect(evaluate).toHaveBeenCalledWith(
      expect.objectContaining({
        bundle: { source: "github-snapshot", input: { slug: "acme/widget", branch: undefined } },
        gridSlug: "code",
        subject: expect.objectContaining({ ref: SB, userId: ALICE, type: "code" }),
        origin: expect.objectContaining({ owner: "sandbox", handler: "formative", challengeId: null }),
      }),
    );

    // Zéro CP : aucun repository de reward n'est touché.
    for (const fn of [...Object.values(rewardRepo), ...Object.values(contributionRepo)]) {
      expect(fn).not.toHaveBeenCalled();
    }
  });

  it("donne à l'agent les artefacts d'une proposition ml, par le contexte de son flow", async () => {
    const { service, evaluate } = makeDeps({
      sandbox: { type: "ml", dataset_urls: ["https://kaggle.com/d/one"] },
    });

    await service.evaluate(EVENT);

    const request = evaluate.mock.calls[0][0];
    expect(request.gridSlug).toBe("code");
    expect(request.subject.description).toContain("Datasets: https://kaggle.com/d/one");
    expect(request.subject.description).not.toContain("Model artifact");
  });

  it("passe à failed et relaie l'erreur quand l'agent lève", async () => {
    const { service, transitions, stored } = makeDeps({ fails: true });

    await expect(service.evaluate(EVENT)).rejects.toThrow("agent down");

    expect(transitions).toEqual([
      { status: "running", expectedFrom: null },
      { status: "failed", expectedFrom: undefined },
    ]);
    expect(stored).toHaveLength(0);
  });

  it("ignore un sandbox déjà en cours d'évaluation", async () => {
    const { service, evaluate, transitions } = makeDeps({
      sandbox: { evaluation_status: "running" },
    });

    await service.evaluate(EVENT);

    expect(evaluate).not.toHaveBeenCalled();
    expect(transitions).toHaveLength(0);
  });

  it("ignore un run dont un autre appel a pris la main", async () => {
    const { service, evaluate } = makeDeps({ claim: false });

    await service.evaluate(EVENT);

    expect(evaluate).not.toHaveBeenCalled();
  });

  it("n'évalue rien pour qui n'est pas l'auteur", async () => {
    const { service, evaluate, transitions } = makeDeps();

    await service.evaluate({ sandboxId: SB, userId: "bob" });

    expect(evaluate).not.toHaveBeenCalled();
    expect(transitions).toHaveLength(0);
  });
});
