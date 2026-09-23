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
    title: "Triage assistant",
    slug: "triage-assistant",
    context: "Emergency triage is slow.",
    goals: ["Parse the intake form", "Rank by severity"],
    why: "Nurses lose hours every shift.",
    cover_image_url: null,
    status: "open",
    promoted_challenge_id: null,
    promoted_at: null,
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
  it("prend le type choisi par l'admin — la proposition n'en porte pas", () => {
    expect(buildPromotedChallengeDraft(sandbox(), { ...baseInput, type: "ml" }).type).toBe("ml");
    expect(buildPromotedChallengeDraft(sandbox(), { ...baseInput, type: "code" }).type).toBe("code");
  });

  it("retombe sur code sans type, et refuse tout autre type", () => {
    // `code` est la forme la plus courante. 'validation' n'a pas de sens ici :
    // un challenge de validation dérive d'un challenge ML existant.
    expect(buildPromotedChallengeDraft(sandbox(), baseInput).type).toBe("code");
    expect(
      buildPromotedChallengeDraft(sandbox(), { ...baseInput, type: "validation" as never }).type,
    ).toBe("code");
  });

  it("force own_repo sur un challenge code, et laisse le mode nul sur un ml", () => {
    expect(
      buildPromotedChallengeDraft(sandbox(), {
        ...baseInput,
        type: "code",
        workspace_mode: "provided_repo",
      }).workspace_mode,
    ).toBe("own_repo");

    expect(
      buildPromotedChallengeDraft(sandbox(), { ...baseInput, type: "ml" }).workspace_mode,
    ).toBeNull();
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
    const ml = buildPromotedChallengeDraft(sandbox(), {
      ...baseInput,
      type: "ml",
      compute_enabled: true,
    });
    expect(ml.compute_enabled).toBe(true);

    const code = buildPromotedChallengeDraft(sandbox(), {
      ...baseInput,
      type: "code",
      compute_enabled: true,
    });
    expect(code.compute_enabled).toBe(false);
    expect(code.source_challenge_id).toBeNull();
    expect(code.cp_per_validation).toBeNull();
    expect(code.required_validations).toBeNull();
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

  it("fait suivre la couverture de la proposition", () => {
    expect(
      buildPromotedChallengeDraft(sandbox({ cover_image_url: "/api/images/x.webp" }), baseInput)
        .cover_image_url,
    ).toBe("/api/images/x.webp");
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
  it("inscrit l'auteur, son workspace restant à déclarer", () => {
    // `pending` et pas `ready` : une proposition ne porte pas de dépôt, il n'y
    // a donc rien à pré-remplir. Ce qui compte est que l'auteur soit membre de
    // son challenge dès la promotion, sans avoir à le rejoindre.
    expect(buildAuthorParticipation(sandbox(), CHALLENGE_ID)).toEqual({
      challenge_id: CHALLENGE_ID,
      user_id: AUTHOR,
      workspace_provider: null,
      workspace_url: null,
      workspace_status: "pending",
    });
  });
});
