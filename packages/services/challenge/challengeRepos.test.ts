import { describe, it, expect } from "vitest";
import { buildRepoDefinitions } from "./challengeRepos.js";

/**
 * Test de **parité** : la référence ci-dessous est la copie littérale de la
 * logique qui vivait inline dans `api/challenges/route.ts` avant l'extraction.
 * Tant que les deux coïncident sur toutes les combinaisons type × mode, un
 * challenge promu depuis un sandbox reçoit exactement les mêmes repos qu'un
 * challenge créé à la main.
 */
function legacyRepoDefinitions(validated: {
  type: string;
  title: string;
  workspace_mode?: "provided_repo" | "own_repo";
  api_packaging_enabled?: boolean;
}, githubSlug?: string) {
  return validated.type === "ml"
    ? [
        { title: `${validated.title} — Dataset`,    type: "kaggle_dataset", role: "dataset"    },
        { title: `${validated.title} — Model`,      type: "kaggle_model",   role: "model"      },
        { title: `${validated.title} — Model Code`, type: "github",         role: "model_code" },
        ...(validated.api_packaging_enabled !== false
          ? [{ title: `${validated.title} — API`, type: "github", role: "api" as const }]
          : []),
      ]
    : validated.type === "validation"
      ? []
      : (validated.workspace_mode ?? "provided_repo") === "own_repo"
        ? []
        : [{ title: `${validated.title} — Code`, type: "github", external_repo_id: githubSlug }];
}

const TITLE = "Triage assistant";
const SLUG = "acme/triage";

describe("buildRepoDefinitions", () => {
  const combinations: {
    label: string;
    validated: Parameters<typeof legacyRepoDefinitions>[0];
    slug?: string;
  }[] = [
    { label: "code + provided_repo", validated: { type: "code", title: TITLE, workspace_mode: "provided_repo" }, slug: SLUG },
    { label: "code + provided_repo sans slug", validated: { type: "code", title: TITLE, workspace_mode: "provided_repo" } },
    { label: "code + own_repo", validated: { type: "code", title: TITLE, workspace_mode: "own_repo" }, slug: SLUG },
    { label: "code sans mode explicite", validated: { type: "code", title: TITLE }, slug: SLUG },
    { label: "ml avec API packaging", validated: { type: "ml", title: TITLE } },
    { label: "ml sans API packaging", validated: { type: "ml", title: TITLE, api_packaging_enabled: false } },
    { label: "validation", validated: { type: "validation", title: TITLE }, slug: SLUG },
  ];

  for (const { label, validated, slug } of combinations) {
    it(`reproduit la construction inline — ${label}`, () => {
      expect(
        buildRepoDefinitions({
          type: validated.type,
          title: validated.title,
          workspaceMode: validated.workspace_mode,
          githubSlug: slug,
          apiPackagingEnabled: validated.api_packaging_enabled,
        }),
      ).toEqual(legacyRepoDefinitions(validated, slug));
    });
  }

  it("ordonne les repos ML dataset → model → model_code → api", () => {
    expect(buildRepoDefinitions({ type: "ml", title: TITLE }).map((r) => r.role)).toEqual([
      "dataset",
      "model",
      "model_code",
      "api",
    ]);
  });

  it("ne crée aucun repo pour un challenge code en own_repo", () => {
    expect(
      buildRepoDefinitions({ type: "code", title: TITLE, workspaceMode: "own_repo", githubSlug: SLUG }),
    ).toEqual([]);
  });

  it("reporte le slug sur l'unique repo d'un challenge code partagé", () => {
    const [repo] = buildRepoDefinitions({ type: "code", title: TITLE, githubSlug: SLUG });
    expect(repo).toEqual({ title: `${TITLE} — Code`, type: "github", external_repo_id: SLUG });
  });
});
