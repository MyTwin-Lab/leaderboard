import { describe, it, expect } from "vitest";
import { splitShares } from "./share.js";

const ALICE = "aaa-alice";
const BOB = "bbb-bob";
const CAROL = "ccc-carol";

const sum = (m: Map<string, number>) => [...m.values()].reduce((s, n) => s + n, 0);

describe("splitShares", () => {
  it("splits evenly when the total divides", () => {
    const shares = splitShares(900, [ALICE, BOB, CAROL], ALICE);
    expect([...shares.values()]).toEqual([300, 300, 300]);
  });

  it("hands the leftover unit to the group holder", () => {
    // 1300 / 3 = 433,33 : une seule unité dépasse, elle revient au porteur.
    const shares = splitShares(1300, [ALICE, BOB, CAROL], BOB);
    expect(shares.get(BOB)).toBe(434);
    expect(shares.get(ALICE)).toBe(433);
    expect(shares.get(CAROL)).toBe(433);
  });

  it("serves the holder first, then the others by id, when two units are left", () => {
    // 1301 / 3 = 433,67 : deux unités, au porteur puis au premier des autres.
    const shares = splitShares(1301, [ALICE, BOB, CAROL], BOB);
    expect(shares.get(BOB)).toBe(434);
    expect(shares.get(ALICE)).toBe(434); // premier des autres, par ordre d'id
    expect(shares.get(CAROL)).toBe(433);
  });

  it("keeps the sum exactly equal to the total, whatever the remainder", () => {
    // L'invariant qui compte : sans lui le leaderboard cesse de sommer au
    // total réellement distribué sur le challenge.
    for (let total = 0; total <= 200; total++) {
      for (const members of [[ALICE], [ALICE, BOB], [ALICE, BOB, CAROL]]) {
        expect(sum(splitShares(total, members, ALICE))).toBe(total);
      }
    }
  });

  it("gives everything to a lone member", () => {
    const shares = splitShares(137, [ALICE], ALICE);
    expect(shares.get(ALICE)).toBe(137);
  });

  it("does not depend on the order the members come in", () => {
    const a = splitShares(1300, [ALICE, BOB, CAROL], BOB);
    const b = splitShares(1300, [CAROL, ALICE, BOB], BOB);
    expect([...b.entries()].sort()).toEqual([...a.entries()].sort());
  });

  it("keeps the sum on a negative total", () => {
    // Une correction de ledger produit un delta négatif à répartir.
    const shares = splitShares(-10, [ALICE, BOB, CAROL], ALICE);
    expect(sum(shares)).toBe(-10);
    expect([...shares.values()].every((n) => n < 0)).toBe(true);
  });

  it("returns nothing for an empty group rather than throwing", () => {
    expect(splitShares(100, [], ALICE).size).toBe(0);
  });

  it("ignores a duplicated member id", () => {
    const shares = splitShares(100, [ALICE, ALICE, BOB], ALICE);
    expect(shares.size).toBe(2);
    expect(sum(shares)).toBe(100);
  });

  it("does not invent a share for a holder outside the group", () => {
    // Composition incohérente : mieux vaut répartir entre les membres réels
    // que créditer quelqu'un qui n'en fait pas partie.
    const shares = splitShares(100, [BOB, CAROL], ALICE);
    expect(shares.has(ALICE)).toBe(false);
    expect(sum(shares)).toBe(100);
  });
});
