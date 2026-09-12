import { describe, it, expect } from "vitest";
import {
  sandboxCreateSchema,
  sandboxUpdateSchema,
  sandboxStarTiersSchema,
  sandboxSettingsPatchSchema,
} from "./schemas_zod.js";

const codeBase = {
  type: "code" as const,
  title: "Prédiction de réadmission",
  repo_url: "https://github.com/acme/readmission",
};

const mlBase = {
  type: "ml" as const,
  title: "Segmentation pulmonaire",
  repo_url: "https://github.com/acme/lungs",
};

describe("sandboxCreateSchema", () => {
  it("accepte un sandbox code avec le seul repo", () => {
    const parsed = sandboxCreateSchema.parse(codeBase);
    expect(parsed.goals).toEqual([]);
    expect(parsed.dataset_urls).toEqual([]);
  });

  it("refuse modèle et datasets sur un sandbox code", () => {
    // Ces champs n'existent que pour le type ml : les accepter ici les rendrait
    // invisibles dans l'UI tout en polluant le contexte d'évaluation.
    expect(
      sandboxCreateSchema.safeParse({ ...codeBase, model_url: "https://kaggle.com/m/x" }).success
    ).toBe(false);
    expect(
      sandboxCreateSchema.safeParse({ ...codeBase, dataset_urls: ["https://kaggle.com/d/x"] }).success
    ).toBe(false);
  });

  it("exige au moins un dataset sur un sandbox ml", () => {
    expect(sandboxCreateSchema.safeParse(mlBase).success).toBe(false);
    expect(
      sandboxCreateSchema.safeParse({ ...mlBase, dataset_urls: ["https://kaggle.com/d/lungs"] })
        .success
    ).toBe(true);
  });

  it("laisse le modèle optionnel sur un sandbox ml", () => {
    // Un sandbox ML peut démarrer avant d'avoir produit un artefact.
    const parsed = sandboxCreateSchema.parse({
      ...mlBase,
      dataset_urls: ["https://kaggle.com/d/lungs"],
    });
    expect(parsed.model_url).toBeUndefined();
  });

  it("refuse une URL qui n'est pas en http(s)", () => {
    for (const repo_url of ["ftp://example.org/repo", "mailto:a@b.c", "pas une url"]) {
      expect(sandboxCreateSchema.safeParse({ ...codeBase, repo_url }).success).toBe(false);
    }
  });
});

describe("sandboxUpdateSchema", () => {
  it("ignore le type — il est figé à la création", () => {
    const parsed = sandboxUpdateSchema.parse({ title: "Nouveau titre", type: "ml" });
    expect(parsed).not.toHaveProperty("type");
    expect(parsed.title).toBe("Nouveau titre");
  });

  it("distingue l'absence d'un null : null vide le champ", () => {
    expect(sandboxUpdateSchema.parse({ model_url: null }).model_url).toBeNull();
    expect(sandboxUpdateSchema.parse({}).model_url).toBeUndefined();
  });
});

describe("sandboxStarTiersSchema", () => {
  it("accepte une liste vide — l'économie est simplement inerte", () => {
    expect(sandboxStarTiersSchema.parse([])).toEqual([]);
  });

  it("exige des seuils strictement croissants", () => {
    const growing = [
      { stars: 5, cp: 50 },
      { stars: 15, cp: 100 },
    ];
    expect(sandboxStarTiersSchema.safeParse(growing).success).toBe(true);
    // Égalité et décroissance rendraient le « palier suivant » indéterminé.
    expect(
      sandboxStarTiersSchema.safeParse([
        { stars: 5, cp: 50 },
        { stars: 5, cp: 100 },
      ]).success
    ).toBe(false);
    expect(
      sandboxStarTiersSchema.safeParse([
        { stars: 15, cp: 100 },
        { stars: 5, cp: 50 },
      ]).success
    ).toBe(false);
  });

  it("plafonne le nombre de paliers", () => {
    const tiers = Array.from({ length: 21 }, (_, i) => ({ stars: i + 1, cp: 10 }));
    expect(sandboxStarTiersSchema.safeParse(tiers).success).toBe(false);
    expect(sandboxStarTiersSchema.safeParse(tiers.slice(0, 20)).success).toBe(true);
  });

  it("refuse un seuil nul ou négatif et un CP négatif", () => {
    expect(sandboxStarTiersSchema.safeParse([{ stars: 0, cp: 50 }]).success).toBe(false);
    expect(sandboxStarTiersSchema.safeParse([{ stars: 5, cp: -1 }]).success).toBe(false);
  });
});

describe("sandboxSettingsPatchSchema", () => {
  it("accepte un patch partiel", () => {
    expect(sandboxSettingsPatchSchema.parse({ sandbox_promotion_bonus_cp: 200 })).toEqual({
      sandbox_promotion_bonus_cp: 200,
    });
  });

  it("plafonne le bonus de promotion", () => {
    // Aucune reprise automatique n'existe : une faute de frappe se paie.
    expect(
      sandboxSettingsPatchSchema.safeParse({ sandbox_promotion_bonus_cp: 1_000_000 }).success
    ).toBe(false);
  });
});
