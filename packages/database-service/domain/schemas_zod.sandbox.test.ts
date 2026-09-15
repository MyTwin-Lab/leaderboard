import { describe, it, expect } from "vitest";
import {
  sandboxCreateSchema,
  sandboxPromotionBonusSchema,
  sandboxUpdateSchema,
  sandboxStarTiersSchema,
} from "./schemas_zod.js";

const base = {
  type: "code",
  title: "Prédiction de réadmission",
  repo_url: "https://github.com/acme/readmission",
};

describe("sandboxCreateSchema", () => {
  it("lit ce que toutes les propositions partagent, et laisse les champs au flow", () => {
    const parsed = sandboxCreateSchema.parse(base);
    expect(parsed).toEqual({ type: "code", title: "Prédiction de réadmission", goals: [] });
  });

  it("accepte n'importe quelle clé de flow : c'est le registre qui dit s'il est proposable", () => {
    expect(sandboxCreateSchema.safeParse({ ...base, type: "journey-validation" }).success).toBe(true);
    expect(sandboxCreateSchema.safeParse({ ...base, type: "" }).success).toBe(false);
    expect(sandboxCreateSchema.safeParse({ title: base.title }).success).toBe(false);
  });

  it("refuse un titre trop court", () => {
    expect(sandboxCreateSchema.safeParse({ ...base, title: "ab" }).success).toBe(false);
  });
});

describe("sandboxUpdateSchema", () => {
  it("ignore le type — il est figé à la création", () => {
    const parsed = sandboxUpdateSchema.parse({ title: "Nouveau titre", type: "ml" });
    expect(parsed).not.toHaveProperty("type");
    expect(parsed.title).toBe("Nouveau titre");
  });

  it("distingue l'absence d'un null : null vide le champ", () => {
    expect(sandboxUpdateSchema.parse({ context: null }).context).toBeNull();
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

describe("sandboxPromotionBonusSchema", () => {
  it("plafonne le bonus de promotion", () => {
    // Aucune reprise automatique n'existe : une faute de frappe se paie.
    expect(sandboxPromotionBonusSchema.safeParse(200).success).toBe(true);
    expect(sandboxPromotionBonusSchema.safeParse(1_000_000).success).toBe(false);
    expect(sandboxPromotionBonusSchema.safeParse(-1).success).toBe(false);
  });
});
