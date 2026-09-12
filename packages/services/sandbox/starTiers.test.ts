import { describe, it, expect } from "vitest";
import { nextTier, sortTiers, tierProgress, tiersToPay } from "./starTiers.js";
import type { SandboxStarTier } from "../../database-service/domain/entities.js";

const TIERS: SandboxStarTier[] = [
  { stars: 5, cp: 50 },
  { stars: 15, cp: 100 },
  { stars: 30, cp: 200 },
];

describe("tiersToPay", () => {
  it("paie un palier exactement franchi", () => {
    expect(tiersToPay(5, TIERS, [])).toEqual([{ stars: 5, cp: 50 }]);
  });

  it("ne paie rien juste sous le seuil", () => {
    expect(tiersToPay(4, TIERS, [])).toEqual([]);
  });

  it("ignore un palier déjà payé", () => {
    expect(tiersToPay(7, TIERS, [5])).toEqual([]);
  });

  it("paie tous les paliers franchis d'un coup", () => {
    expect(tiersToPay(15, TIERS, [])).toEqual([
      { stars: 5, cp: 50 },
      { stars: 15, cp: 100 },
    ]);
  });

  it("ne paie rien quand aucun palier n'est configuré", () => {
    expect(tiersToPay(100, [], [])).toEqual([]);
  });

  // Le rattachement d'une identité anonyme fait baisser le compteur sous un
  // seuil déjà payé : le palier reste acquis, et rien n'est re-proposé.
  it("ne re-propose pas un palier payé dont le compteur est redescendu", () => {
    expect(tiersToPay(3, TIERS, [5])).toEqual([]);
  });

  // Pas de rattrapage rétroactif à l'enregistrement des réglages : le palier
  // ajouté après coup est ramassé au passage suivant.
  it("paie au passage suivant un palier ajouté après coup", () => {
    const withNewTier: SandboxStarTier[] = [...TIERS, { stars: 10, cp: 75 }];
    expect(tiersToPay(12, withNewTier, [5])).toEqual([{ stars: 10, cp: 75 }]);
  });

  it("trie les paliers reçus dans le désordre", () => {
    const shuffled: SandboxStarTier[] = [
      { stars: 30, cp: 200 },
      { stars: 5, cp: 50 },
      { stars: 15, cp: 100 },
    ];
    expect(tiersToPay(30, shuffled, []).map((t) => t.stars)).toEqual([5, 15, 30]);
    expect(sortTiers(shuffled).map((t) => t.stars)).toEqual([5, 15, 30]);
  });
});

describe("nextTier", () => {
  it("renvoie le premier palier strictement au-dessus du compteur", () => {
    expect(nextTier(0, TIERS)).toEqual({ stars: 5, cp: 50 });
    expect(nextTier(5, TIERS)).toEqual({ stars: 15, cp: 100 });
  });

  it("renvoie null quand tous les paliers sont atteints", () => {
    expect(nextTier(30, TIERS)).toBeNull();
    expect(nextTier(0, [])).toBeNull();
  });
});

describe("tierProgress", () => {
  it("mesure la progression entre le palier atteint et le suivant", () => {
    expect(tierProgress(3, TIERS)).toEqual({ pct: 60, hint: "2 more stars to +50 CP" });
    // 7 stars : entre 5 et 15, donc 2/10.
    expect(tierProgress(7, TIERS)).toEqual({ pct: 20, hint: "8 more stars to +100 CP" });
  });

  it("accorde le singulier à une star restante", () => {
    expect(tierProgress(4, TIERS).hint).toBe("1 more star to +50 CP");
  });

  it("annonce le total payé quand tous les paliers sont atteints", () => {
    expect(tierProgress(30, TIERS)).toEqual({
      pct: 100,
      hint: "All milestones reached · 350 CP paid",
    });
  });

  it("reste inerte quand aucun palier n'est configuré", () => {
    expect(tierProgress(12, [])).toEqual({ pct: 0, hint: "No milestones configured" });
  });
});
