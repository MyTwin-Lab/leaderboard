import { describe, it, expect } from "vitest";
import type { Sandbox } from "../../database-service/domain/entities.js";
import {
  buildAuthorParticipation,
  buildPromotedChallengeDraft,
  buildPromotedDescription,
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
  it("hérite le flow de la proposition, même quand l'entrée en réclame un autre", () => {
    const draft = buildPromotedChallengeDraft(sandbox({ type: "ml" }), {
      ...baseInput,
      type: "validation",
    });
    expect(draft.type).toBe("ml");
  });

  it("pose la configuration décidée par le flow, et ignore le mode demandé", () => {
    expect(
      buildPromotedChallengeDraft(
        sandbox({ type: "code" }),
        { ...baseInput, workspace_mode: "provided_repo" },
        { workspace_mode: "own_repo" },
      ).flow_config,
    ).toEqual({ workspace_mode: "own_repo" });

    // Un flow sans décision de promotion : une configuration vide, que son schéma complète.
    expect(buildPromotedChallengeDraft(sandbox(), baseInput).flow_config).toEqual({});
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

  it("ne pose jamais les champs de validation", () => {
    const draft = buildPromotedChallengeDraft(sandbox(), baseInput);
    expect(draft.source_challenge_id).toBeNull();
    expect(draft.completion).toBe(0);
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
