import { describe, it, expect } from "vitest";
import type { Sandbox } from "../../database-service/domain/entities.js";
import {
  buildAuthorParticipation,
  buildPromotedBrief,
  buildPromotedChallengeDraft,
  buildPromotedDescription,
  buildPromotedProject,
  resolvePromotedBrief,
  type PromotionInput,
} from "./promotion.js";

const AUTHOR = "user-1";
const CHALLENGE_ID = "challenge-1";

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
};

describe("buildPromotedProject", () => {
  it("nomme le projet comme la proposition et en fait l'auteur le manager", () => {
    // Toujours un nouveau projet : un sandbox *est* un projet, la promotion le
    // rend officiel. Le manager est ce qui donne à l'auteur la main dessus.
    expect(buildPromotedProject(sandbox())).toEqual({
      title: "Triage assistant",
      description: "Emergency triage is slow.",
      manager_id: AUTHOR,
    });
  });

  it("laisse la description nulle sans contexte", () => {
    expect(buildPromotedProject(sandbox({ context: "  " })).description).toBeNull();
  });
});

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
      }).flow_config,
    ).toEqual({ workspace_mode: "own_repo" });

    expect(
      buildPromotedChallengeDraft(sandbox(), { ...baseInput, type: "ml" }).flow_config,
    ).not.toHaveProperty("workspace_mode");
  });

  it("reprend le titre de la proposition quand l'admin n'en saisit pas", () => {
    expect(buildPromotedChallengeDraft(sandbox(), baseInput).title).toBe("Triage assistant");
    expect(
      buildPromotedChallengeDraft(sandbox(), { ...baseInput, title: "  Renamed  " }).title,
    ).toBe("Renamed");
  });

  it("prend le contexte comme accroche quand la description est absente, et respecte celle de l'admin sinon", () => {
    // Les trois sections vont dans le brief : la description ne les recopie
    // pas, elle n'est que l'accroche des cartes.
    expect(buildPromotedChallengeDraft(sandbox(), baseInput).description).toBe("Emergency triage is slow.");
    expect(
      buildPromotedChallengeDraft(sandbox(), { ...baseInput, description: "Rewritten." }).description,
    ).toBe("Rewritten.");
    expect(buildPromotedChallengeDraft(sandbox({ context: null }), baseInput).description).toBeNull();
  });

  it("ne porte pas de project_id : le projet naît avec le challenge", () => {
    expect(buildPromotedChallengeDraft(sandbox(), baseInput)).not.toHaveProperty("project_id");
  });

  it("n'active le compute que sur un ml, et jamais les champs de validation", () => {
    const ml = buildPromotedChallengeDraft(sandbox(), {
      ...baseInput,
      type: "ml",
      compute_enabled: true,
    });
    expect(ml.flow_config).toEqual({ extensions: { compute: { enabled: true } } });

    const code = buildPromotedChallengeDraft(sandbox(), {
      ...baseInput,
      type: "code",
      compute_enabled: true,
    });
    expect(code.flow_config).toEqual({ workspace_mode: "own_repo" });
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

  it("fait suivre la couverture de la proposition", () => {
    expect(
      buildPromotedChallengeDraft(sandbox({ cover_image_url: "/api/images/x.webp" }), baseInput)
        .cover_image_url,
    ).toBe("/api/images/x.webp");
  });
});

describe("buildPromotedDescription", () => {
  it("rend le contexte, nettoyé, ou une chaîne vide", () => {
    expect(buildPromotedDescription(sandbox({ context: "  Slow.  " }))).toBe("Slow.");
    expect(buildPromotedDescription(sandbox({ context: null }))).toBe("");
  });
});

describe("buildPromotedBrief", () => {
  it("compose le brief dans la forme du squelette : Context puis Objective", () => {
    // La vitrine lit `## Context` comme « Why this challenge exists » : le
    // contexte et le why de la proposition y vont tous les deux.
    expect(buildPromotedBrief(sandbox())).toBe(
      [
        "## Context\n\nEmergency triage is slow.\n\nNurses lose hours every shift.",
        "## Objective\n\n- Parse the intake form\n- Rank by severity",
      ].join("\n\n"),
    );
  });

  it("n'écrit aucun titre pour une section vide", () => {
    const composed = buildPromotedBrief(sandbox({ context: null, why: "   ", goals: ["Ship it"] }));
    expect(composed).toBe("## Objective\n\n- Ship it");
    expect(composed).not.toContain("## Context");
  });

  it("garde le contexte seul sous Context quand le why manque", () => {
    expect(buildPromotedBrief(sandbox({ why: null, goals: [] }))).toBe("## Context\n\nEmergency triage is slow.");
  });

  it("n'écrit jamais la section Expected result : une proposition n'en a pas", () => {
    expect(buildPromotedBrief(sandbox())).not.toContain("Expected result");
  });

  it("rend une chaîne vide quand la proposition n'a aucune section", () => {
    expect(buildPromotedBrief(sandbox({ context: null, why: null, goals: [] }))).toBe("");
  });
});

describe("resolvePromotedBrief", () => {
  it("compose le brief quand la promotion arrive sans", () => {
    expect(resolvePromotedBrief(sandbox(), {})).toContain("## Context");
    expect(resolvePromotedBrief(sandbox(), { brief: null })).toContain("## Context");
  });

  it("respecte le brief relu par l'admin, et son effacement", () => {
    expect(resolvePromotedBrief(sandbox(), { brief: "  ## Context\n\nRewritten.  " })).toBe("## Context\n\nRewritten.");
    // Vide est un choix : le challenge naît sans brief.
    expect(resolvePromotedBrief(sandbox(), { brief: "   " })).toBe("");
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
