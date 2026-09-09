import { describe, it, expect, vi } from "vitest";
import {
  SandboxEvaluationService,
  buildEvaluationContext,
} from "./sandbox-evaluation.service.js";
import type { Sandbox } from "../../database-service/domain/entities.js";

const SB = "sb-1";
const ALICE = "alice";

function makeSandbox(over: Partial<Sandbox> = {}): Sandbox {
  return {
    uuid: SB,
    user_id: ALICE,
    type: "code",
    title: "Widget",
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
 * Les repositories de reward sont montés dans les dépendances **exprès** : ils
 * n'y ont rien à faire, et le test vérifie qu'aucune de leurs méthodes n'est
 * appelée. Une évaluation formative ne paie pas de CP.
 */
function makeDeps(opts: { sandbox?: Partial<Sandbox> | null; statuses?: Array<Partial<Sandbox> | null>; claim?: boolean; fails?: boolean } = {}) {
  const statusReads = [...(opts.statuses ?? [])];
  const stored: Array<{ evaluation: unknown; status: string }> = [];
  const transitions: Array<{ status: string; expectedFrom?: unknown }> = [];

  let call = 0;
  const sandboxRepo = {
    findById: vi.fn(async () => {
      const override = call++ === 0 || statusReads.length === 0 ? opts.sandbox : statusReads.shift();
      if (override === null) return null;
      return makeSandbox(override ?? {});
    }),
    setEvaluationStatus: vi.fn(async (_uuid: string, status: string, o?: { expectedFrom?: unknown }) => {
      transitions.push({ status, expectedFrom: o?.expectedFrom });
      return opts.claim === false && status === "running" ? false : true;
    }),
    storeEvaluation: vi.fn(async (_uuid: string, evaluation: unknown, status = "done") => {
      stored.push({ evaluation, status });
      return makeSandbox();
    }),
  };

  const evaluateRepo = vi.fn(async () => {
    if (opts.fails) throw new Error("agent down");
    return { score10: 8, evaluation: { globalScore: 7.2, scores: [] } };
  });

  // Les repositories de reward : jamais touchés, et c'est ce qu'on vérifie.
  const rewardRepo = {
    insertTierIfAbsent: vi.fn(),
    paidTierThresholdsBySandboxIds: vi.fn(),
    findBySandbox: vi.fn(),
  };
  const contributionRepo = { create: vi.fn(), update: vi.fn() };

  const service = new SandboxEvaluationService({ sandboxRepo, evaluateRepo } as any);
  return { service, sandboxRepo, evaluateRepo, rewardRepo, contributionRepo, stored, transitions };
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

  it("injecte modèle et datasets d'un sandbox ml", () => {
    const text = buildEvaluationContext(
      makeSandbox({
        type: "ml",
        model_url: "https://hf.co/acme/model",
        dataset_urls: ["https://kaggle.com/d/one", "https://kaggle.com/d/two"],
      }),
    );
    expect(text).toContain("Model artifact: https://hf.co/acme/model");
    expect(text).toContain("Datasets: https://kaggle.com/d/one, https://kaggle.com/d/two");
  });

  it("un sandbox ml sans modèle ne produit aucune ligne Model artifact", () => {
    const text = buildEvaluationContext(
      makeSandbox({ type: "ml", model_url: null, dataset_urls: ["https://kaggle.com/d/one"] }),
    );
    expect(text).not.toContain("Model artifact");
    expect(text).toContain("Datasets: https://kaggle.com/d/one");
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

  it("refuse une URL de repo inexploitable", async () => {
    const { service } = makeDeps({ sandbox: { repo_url: "https://gitlab.com/acme/widget" } });
    expect(await service.canEvaluate(SB, ALICE)).toEqual({ ok: false, reason: "invalid_repo" });
  });

  it("refuse tant qu'un run est en vol", async () => {
    const { service } = makeDeps({ sandbox: { evaluation_status: "running" } });
    expect(await service.canEvaluate(SB, ALICE)).toEqual({ ok: false, reason: "already_running" });
  });
});

describe("SandboxEvaluationService.evaluate", () => {
  it("passe à running puis stocke le résultat en done", async () => {
    const { service, evaluateRepo, transitions, stored, rewardRepo, contributionRepo } = makeDeps();

    await service.evaluate({ sandboxId: SB, userId: ALICE });

    expect(transitions).toEqual([{ status: "running", expectedFrom: null }]);
    expect(stored).toEqual([{ evaluation: { globalScore: 7.2, scores: [] }, status: "done" }]);

    // Grille `code` quel que soit le type (§1.3), et le contexte en description.
    expect(evaluateRepo).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: "acme/widget",
        gridSlug: "code",
        subject: expect.objectContaining({ challengeId: SB, userId: ALICE }),
      }),
    );

    // Zéro CP : aucun repository de reward n'est touché.
    for (const fn of [...Object.values(rewardRepo), ...Object.values(contributionRepo)]) {
      expect(fn).not.toHaveBeenCalled();
    }
  });

  it("évalue un sandbox ml avec la grille code et le contexte enrichi", async () => {
    const { service, evaluateRepo } = makeDeps({
      sandbox: { type: "ml", dataset_urls: ["https://kaggle.com/d/one"] },
    });

    await service.evaluate({ sandboxId: SB, userId: ALICE });

    const input = (evaluateRepo.mock.calls[0] as unknown as any[])[0];
    expect(input.gridSlug).toBe("code");
    expect(input.subject.description).toContain("Datasets: https://kaggle.com/d/one");
    expect(input.subject.description).not.toContain("Model artifact");
  });

  it("passe à failed et relaie l'erreur quand l'agent lève", async () => {
    const { service, transitions, stored } = makeDeps({ fails: true });

    await expect(service.evaluate({ sandboxId: SB, userId: ALICE })).rejects.toThrow("agent down");

    expect(transitions).toEqual([
      { status: "running", expectedFrom: null },
      { status: "failed", expectedFrom: undefined },
    ]);
    expect(stored).toHaveLength(0);
  });

  it("ignore un sandbox déjà en cours d'évaluation", async () => {
    const { service, evaluateRepo, transitions } = makeDeps({
      sandbox: { evaluation_status: "running" },
    });

    await service.evaluate({ sandboxId: SB, userId: ALICE });

    expect(evaluateRepo).not.toHaveBeenCalled();
    expect(transitions).toHaveLength(0);
  });

  it("ignore un run dont un autre appel a pris la main entre les deux lectures", async () => {
    const { service, evaluateRepo, transitions } = makeDeps({ claim: false });

    await service.evaluate({ sandboxId: SB, userId: ALICE });

    // La bascule a été tentée, le compare-and-set l'a refusée.
    expect(transitions).toEqual([{ status: "running", expectedFrom: null }]);
    expect(evaluateRepo).not.toHaveBeenCalled();
  });

  it("n'évalue rien pour qui n'est pas l'auteur", async () => {
    const { service, evaluateRepo, transitions } = makeDeps();

    await service.evaluate({ sandboxId: SB, userId: "bob" });

    expect(evaluateRepo).not.toHaveBeenCalled();
    expect(transitions).toHaveLength(0);
  });

  it("relit le statut juste avant la bascule", async () => {
    // Première lecture : rien en cours. Seconde : un autre run a démarré.
    const { service, evaluateRepo, transitions, sandboxRepo } = makeDeps({
      statuses: [{ evaluation_status: "running" }],
    });

    await service.evaluate({ sandboxId: SB, userId: ALICE });

    expect(sandboxRepo.findById).toHaveBeenCalledTimes(2);
    expect(transitions).toHaveLength(0);
    expect(evaluateRepo).not.toHaveBeenCalled();
  });
});
