import { describe, it, expect } from "vitest";
import type { Sandbox } from "../../database-service/domain/entities.js";
import {
  buildAuthorContributions,
  buildAuthorParticipation,
  buildPromotedChallengeDraft,
  buildPromotedDescription,
  seedMlWorkspaceMeta,
  type PromotionInput,
} from "./promotion.js";

const AUTHOR = "user-1";
const CHALLENGE_ID = "challenge-1";
const PROJECT_ID = "11111111-1111-4111-8111-111111111111";

function sandbox(overrides: Partial<Sandbox> = {}): Sandbox {
  return {
    uuid: "sandbox-1",
    user_id: AUTHOR,
    type: "code",
    title: "Triage assistant",
    slug: "triage-assistant",
    context: "Emergency triage is slow.",
    goals: ["Parse the intake form", "Rank by severity"],
    why: "Nurses lose hours every shift.",
    repo_url: "https://github.com/alice/triage",
    model_url: null,
    dataset_urls: [],
    status: "open",
    promoted_challenge_id: null,
    promoted_at: null,
    evaluation: undefined,
    evaluation_status: null,
    evaluated_at: null,
    created_at: new Date("2026-01-01T00:00:00Z"),
    updated_at: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

const baseInput: PromotionInput = {
  status: "active",
  contribution_points_reward: 500,
  project_id: PROJECT_ID,
};

describe("buildPromotedChallengeDraft", () => {
  it("hérite le type de la proposition, même quand l'entrée en réclame un autre", () => {
    const draft = buildPromotedChallengeDraft(sandbox({ type: "ml" }), {
      ...baseInput,
      type: "validation",
    });
    expect(draft.type).toBe("ml");
  });

  it("force own_repo pour un sandbox code, et ne pose aucun mode pour un ml", () => {
    expect(
      buildPromotedChallengeDraft(sandbox({ type: "code" }), {
        ...baseInput,
        workspace_mode: "provided_repo",
      }).flow_config,
    ).toEqual({ workspace_mode: "own_repo" });

    expect(buildPromotedChallengeDraft(sandbox({ type: "ml" }), baseInput).flow_config.workspace_mode).toBeUndefined();
  });

  it("reprend le titre de la proposition quand l'admin n'en saisit pas", () => {
    expect(buildPromotedChallengeDraft(sandbox(), baseInput).title).toBe("Triage assistant");
    expect(
      buildPromotedChallengeDraft(sandbox(), { ...baseInput, title: "  Renamed  " }).title,
    ).toBe("Renamed");
  });

  it("compose la description quand elle est absente, et respecte celle de l'admin sinon", () => {
    expect(buildPromotedChallengeDraft(sandbox(), baseInput).description).toContain("## Context");
    expect(
      buildPromotedChallengeDraft(sandbox(), { ...baseInput, description: "Rewritten." }).description,
    ).toBe("Rewritten.");
  });

  it("n'active le compute que sur un ml, et jamais les champs de validation", () => {
    const ml = buildPromotedChallengeDraft(sandbox({ type: "ml" }), {
      ...baseInput,
      compute_enabled: true,
    });
    expect(ml.flow_config).toEqual({ extensions: { compute: { enabled: true } } });

    const code = buildPromotedChallengeDraft(sandbox({ type: "code" }), {
      ...baseInput,
      compute_enabled: true,
    });
    expect(code.flow_config.extensions).toBeUndefined();
    expect(code.source_challenge_id).toBeNull();
    expect(code.completion).toBe(0);
  });

  it("traite une date vide comme une absence de date", () => {
    const draft = buildPromotedChallengeDraft(sandbox(), {
      ...baseInput,
      start_date: "",
      end_date: "2026-06-01",
    });
    expect(draft.start_date).toBeNull();
    expect(draft.end_date).toEqual(new Date("2026-06-01"));
  });
});

describe("buildPromotedDescription", () => {
  it("compose les trois sections dans l'ordre de la page détail", () => {
    expect(buildPromotedDescription(sandbox())).toBe(
      [
        "## Context\n\nEmergency triage is slow.",
        "## What I want to build\n\n- Parse the intake form\n- Rank by severity",
        "## Why it matters\n\nNurses lose hours every shift.",
      ].join("\n\n"),
    );
  });

  it("n'écrit aucun titre pour une section vide", () => {
    const composed = buildPromotedDescription(sandbox({ context: null, why: "   ", goals: ["Ship it"] }));
    expect(composed).toBe("## What I want to build\n\n- Ship it");
    expect(composed).not.toContain("## Context");
    expect(composed).not.toContain("## Why it matters");
  });

  it("rend une chaîne vide quand la proposition n'a aucune section", () => {
    expect(buildPromotedDescription(sandbox({ context: null, why: null, goals: [] }))).toBe("");
    expect(
      buildPromotedChallengeDraft(sandbox({ context: null, why: null, goals: [] }), baseInput)
        .description,
    ).toBeNull();
  });
});

describe("buildAuthorParticipation", () => {
  it("inscrit l'auteur avec son dépôt, prêt à être évalué", () => {
    expect(buildAuthorParticipation(sandbox(), CHALLENGE_ID)).toEqual({
      challenge_id: CHALLENGE_ID,
      user_id: AUTHOR,
      workspace_provider: "external",
      workspace_url: "https://github.com/alice/triage",
      workspace_status: "ready",
    });
  });
});

describe("seedMlWorkspaceMeta", () => {
  const mlSandbox = sandbox({
    type: "ml",
    model_url: "https://kaggle.com/models/alice/triage",
    dataset_urls: ["https://kaggle.com/datasets/alice/intake", "https://kaggle.com/datasets/bob/vitals"],
  });

  it("recopie datasets, modèle et code dans les formes attendues par le workspace ML", () => {
    expect(seedMlWorkspaceMeta(mlSandbox, AUTHOR)).toEqual({
      dataset: {
        userUrls: { [AUTHOR]: "https://kaggle.com/datasets/alice/intake" },
        datasetUrls: {
          [AUTHOR]: [
            "https://kaggle.com/datasets/alice/intake",
            "https://kaggle.com/datasets/bob/vitals",
          ],
        },
      },
      model: { userUrls: { [AUTHOR]: "https://kaggle.com/models/alice/triage" } },
      model_code: { userUrls: { [AUTHOR]: "https://github.com/alice/triage" } },
    });
  });

  it("n'écrit rien pour le rôle model quand la proposition n'a pas de modèle", () => {
    const seed = seedMlWorkspaceMeta(sandbox({ ...mlSandbox, model_url: null }), AUTHOR);
    expect(seed.model).toBeUndefined();
    expect(seed.dataset).toBeDefined();
    expect(seed.model_code).toBeDefined();
  });

  it("ne produit aucun workspace pour un sandbox code", () => {
    expect(seedMlWorkspaceMeta(sandbox({ type: "code" }), AUTHOR)).toEqual({});
  });
});

describe("buildAuthorContributions", () => {
  const mlSandbox = sandbox({
    type: "ml",
    model_url: "https://kaggle.com/models/alice/triage",
    dataset_urls: ["https://kaggle.com/datasets/alice/intake"],
  });
  const now = new Date("2026-02-02T10:00:00Z");

  it("reprend le dataset et le code du modèle, jamais le modèle seul", () => {
    const drafts = buildAuthorContributions(mlSandbox, CHALLENGE_ID, now);
    expect(drafts.map((d) => d.role)).toEqual(["dataset", "model_code"]);

    const [dataset, modelCode] = drafts;
    expect(dataset.contribution.type).toBe("dataset");
    expect(dataset.contribution.artifact_url).toBe("kaggle.com/datasets/alice/intake");
    expect(dataset.url).toBe("https://kaggle.com/datasets/alice/intake");

    // L'étape modèle n'a qu'une contribution pour ses deux repos, et le code
    // n'identifie pas l'artefact — pas d'artifact_url.
    expect(modelCode.contribution.type).toBe("model");
    expect(modelCode.contribution.artifact_url).toBeUndefined();
    expect(modelCode.contribution.description).toBe(
      "model: https://kaggle.com/models/alice/triage\nmodel_code: https://github.com/alice/triage",
    );
    expect(modelCode.url).toBe("https://github.com/alice/triage");
  });

  it("omet la ligne model quand la proposition n'a pas de modèle", () => {
    const [, ...rest] = buildAuthorContributions(
      sandbox({ ...mlSandbox, model_url: null }),
      CHALLENGE_ID,
      now,
    );
    expect(rest[0].contribution.description).toBe("model_code: https://github.com/alice/triage");
  });

  it("ne reprend rien pour un sandbox code — son dépôt suit le cycle du challenge", () => {
    expect(buildAuthorContributions(sandbox({ type: "code" }), CHALLENGE_ID, now)).toEqual([]);
  });

  it("marque les contributions à évaluer, à zéro CP, au nom de l'auteur", () => {
    for (const draft of buildAuthorContributions(mlSandbox, CHALLENGE_ID, now)) {
      expect(draft.contribution).toMatchObject({
        reward: 0,
        user_id: AUTHOR,
        challenge_id: CHALLENGE_ID,
        evaluation_status: "pending",
        submitted_at: now,
      });
    }
  });
});
