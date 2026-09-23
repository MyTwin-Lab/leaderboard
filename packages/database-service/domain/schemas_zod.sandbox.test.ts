import { describe, it, expect } from "vitest";
import {
  sandboxCreateSchema,
  sandboxUpdateSchema,
  sandboxStarTiersSchema,
  sandboxSettingsPatchSchema,
} from "./schemas_zod.js";

const base = {
  title: "Prédiction de réadmission",
};

describe("sandboxCreateSchema", () => {
  it("accepte une proposition réduite à son titre", () => {
    // Un sandbox est un projet : ce qu'on dépose, c'est une idée. Ni type, ni
    // dépôt, ni URLs ML — rien de tout ça n'est demandé à la création.
    const parsed = sandboxCreateSchema.parse(base);
    expect(parsed.goals).toEqual([]);
    expect(parsed.title).toBe(base.title);
  });

  it("ignore le type, le dépôt et les URLs ML", () => {
    // Envoyés par un vieux client, ils ne doivent rien écrire — et surtout pas
    // faire échouer la création. Les colonnes n'existent plus.
    const parsed = sandboxCreateSchema.parse({
      ...base,
      type: "ml",
      repo_url: "https://github.com/acme/readmission",
      model_url: "https://kaggle.com/m/x",
      dataset_urls: ["https://kaggle.com/d/x"],
    });
    expect(parsed).not.toHaveProperty("type");
    expect(parsed).not.toHaveProperty("repo_url");
    expect(parsed).not.toHaveProperty("model_url");
    expect(parsed).not.toHaveProperty("dataset_urls");
  });

  it("exige un titre d'au moins trois caractères", () => {
    expect(sandboxCreateSchema.safeParse({ title: "ok" }).success).toBe(false);
    expect(sandboxCreateSchema.safeParse({}).success).toBe(false);
  });
});

describe("sandboxUpdateSchema", () => {
  it("ignore le type — il n'est plus saisi nulle part", () => {
    const parsed = sandboxUpdateSchema.parse({ title: "Nouveau titre", type: "ml" });
    expect(parsed).not.toHaveProperty("type");
    expect(parsed.title).toBe("Nouveau titre");
  });

  it("ignore le dépôt et les URLs ML, comme la création", () => {
    const parsed = sandboxUpdateSchema.parse({
      repo_url: "https://github.com/acme/x",
      model_url: "https://kaggle.com/m/x",
      dataset_urls: ["https://kaggle.com/d/x"],
    });
    expect(parsed).not.toHaveProperty("repo_url");
    expect(parsed).not.toHaveProperty("model_url");
    expect(parsed).not.toHaveProperty("dataset_urls");
  });

  it("distingue l'absence d'un null : null vide le champ", () => {
    expect(sandboxUpdateSchema.parse({ context: null }).context).toBeNull();
    expect(sandboxUpdateSchema.parse({ cover_image_url: null }).cover_image_url).toBeNull();
    expect(sandboxUpdateSchema.parse({}).context).toBeUndefined();
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
