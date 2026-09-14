import { describe, it, expect, vi } from "vitest";
import {
  SandboxEvaluationService,
  buildEvaluationContext,
} from "./sandbox-evaluation.service.js";
import type { Sandbox } from "../../database-service/domain/entities.js";

const SB = "sb-1";
const ALICE = "alice";
const EVENT = { sandboxId: SB, userId: ALICE };

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

describe("SandboxEvaluationService.claim", () => {
  it("bascule en running par compare-and-set, sans lancer l'agent", async () => {
    const { service, transitions, evaluateRepo } = makeDeps();

    expect(await service.claim(EVENT)).toEqual({ ok: true });

    expect(transitions).toEqual([{ status: "running", expectedFrom: null }]);
    expect(evaluateRepo).not.toHaveBeenCalled();
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
    [{ sandbox: { repo_url: "https://gitlab.com/acme/widget" } }, ALICE, "invalid_repo"],
    [{ sandbox: { evaluation_status: "pending" as const } }, ALICE, "already_running"],
  ] as const)("refuse sans rien écrire (%#)", async (opts, userId, reason) => {
    const { service, transitions } = makeDeps(opts as any);

    expect(await service.claim({ sandboxId: SB, userId })).toEqual({ ok: false, reason });
    expect(transitions).toHaveLength(0);
  });
});

describe("SandboxEvaluationService.run", () => {
  it("n'évalue rien sans claim préalable", async () => {
    const { service, evaluateRepo, transitions } = makeDeps();

    await service.run(EVENT);

    expect(evaluateRepo).not.toHaveBeenCalled();
    expect(transitions).toHaveLength(0);
  });

  it("n'évalue rien pour qui n'est pas l'auteur", async () => {
    const { service, evaluateRepo, transitions } = makeDeps({ sandbox: { evaluation_status: "running" } });

    await service.run({ sandboxId: SB, userId: "bob" });

    expect(evaluateRepo).not.toHaveBeenCalled();
    expect(transitions).toHaveLength(0);
  });

  it("passe à failed si l'URL du repo n'est plus exploitable", async () => {
    const { service, evaluateRepo, transitions } = makeDeps({
      sandbox: { evaluation_status: "running", repo_url: "https://gitlab.com/acme/widget" },
    });

    await expect(service.run(EVENT)).rejects.toThrow("Unparseable repo URL");

    expect(evaluateRepo).not.toHaveBeenCalled();
    expect(transitions).toEqual([{ status: "failed", expectedFrom: undefined }]);
  });
});

describe("SandboxEvaluationService.evaluate", () => {
  it("passe à running puis stocke le résultat en done", async () => {
    const { service, evaluateRepo, transitions, stored, rewardRepo, contributionRepo } = makeDeps();

    await service.evaluate(EVENT);

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

    await service.evaluate(EVENT);

    const input = (evaluateRepo.mock.calls[0] as unknown as any[])[0];
    expect(input.gridSlug).toBe("code");
    expect(input.subject.description).toContain("Datasets: https://kaggle.com/d/one");
    expect(input.subject.description).not.toContain("Model artifact");
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
    const { service, evaluateRepo, transitions } = makeDeps({
      sandbox: { evaluation_status: "running" },
    });

    await service.evaluate(EVENT);

    expect(evaluateRepo).not.toHaveBeenCalled();
    expect(transitions).toHaveLength(0);
  });

  it("ignore un run dont un autre appel a pris la main", async () => {
    const { service, evaluateRepo } = makeDeps({ claim: false });

    await service.evaluate(EVENT);

    expect(evaluateRepo).not.toHaveBeenCalled();
  });

  it("n'évalue rien pour qui n'est pas l'auteur", async () => {
    const { service, evaluateRepo, transitions } = makeDeps();

    await service.evaluate({ sandboxId: SB, userId: "bob" });

    expect(evaluateRepo).not.toHaveBeenCalled();
    expect(transitions).toHaveLength(0);
  });
});
