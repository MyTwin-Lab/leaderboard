import { describe, it, expect } from "vitest";
import { planAnonAttach } from "./starAttach.js";
import type { SandboxStar } from "../../database-service/domain/entities.js";

function anonStar(uuid: string, sandboxId: string, over: Partial<SandboxStar> = {}): SandboxStar {
  return {
    uuid,
    sandbox_id: sandboxId,
    user_id: null,
    anon_id: "anon-1",
    origin: "anonymous",
    ip_hash: null,
    created_at: new Date("2026-09-01T00:00:00.000Z"),
    removed_at: null,
    attached_at: null,
    ...over,
  };
}

function accountStar(uuid: string, sandboxId: string, over: Partial<SandboxStar> = {}): SandboxStar {
  return {
    uuid,
    sandbox_id: sandboxId,
    user_id: "alice",
    anon_id: null,
    origin: "account",
    ip_hash: null,
    created_at: new Date("2026-09-01T00:00:00.000Z"),
    removed_at: null,
    attached_at: null,
    ...over,
  };
}

describe("planAnonAttach", () => {
  it("migre une ligne anonyme sans conflit", () => {
    const plan = planAnonAttach([anonStar("s-1", "sb-1")], [], []);
    expect(plan).toEqual({ toDelete: [], toAttach: ["s-1"] });
  });

  it("supprime la ligne anonyme quand le compte a déjà une ligne active", () => {
    const plan = planAnonAttach([anonStar("s-1", "sb-1")], [accountStar("a-1", "sb-1")], []);
    expect(plan).toEqual({ toDelete: ["s-1"], toAttach: [] });
  });

  // L'index unique `(sandbox_id, user_id)` ne connaît pas `removed_at` :
  // migrer par dessus une ligne de compte soft-removed le violerait.
  it("supprime aussi quand la ligne de compte est soft-removed", () => {
    const removed = accountStar("a-1", "sb-1", { removed_at: new Date("2026-09-02T00:00:00.000Z") });
    const plan = planAnonAttach([anonStar("s-1", "sb-1")], [removed], []);
    expect(plan).toEqual({ toDelete: ["s-1"], toAttach: [] });
  });

  it("supprime la ligne anonyme sur un sandbox possédé par le compte", () => {
    const plan = planAnonAttach([anonStar("s-1", "sb-1")], [], ["sb-1"]);
    expect(plan).toEqual({ toDelete: ["s-1"], toAttach: [] });
  });

  // La trace d'audit suit la personne : une re-star ultérieure réactivera
  // cette ligne au lieu d'en créer une seconde.
  it("migre une ligne anonyme soft-removed sans conflit", () => {
    const removed = anonStar("s-1", "sb-1", { removed_at: new Date("2026-09-02T00:00:00.000Z") });
    const plan = planAnonAttach([removed], [], []);
    expect(plan).toEqual({ toDelete: [], toAttach: ["s-1"] });
  });

  // Au rejeu il ne reste plus aucune ligne `user_id IS NULL` pour cet anon_id :
  // la transaction reçoit une liste vide et les deux étapes sont des no-ops.
  it("produit un plan vide au rejeu sur un état déjà rattaché", () => {
    const plan = planAnonAttach([], [accountStar("a-1", "sb-1")], ["sb-2"]);
    expect(plan).toEqual({ toDelete: [], toAttach: [] });
  });

  it("trie les cas mélangés sur plusieurs sandboxes", () => {
    const plan = planAnonAttach(
      [anonStar("s-1", "sb-1"), anonStar("s-2", "sb-2"), anonStar("s-3", "sb-3")],
      [accountStar("a-2", "sb-2")],
      ["sb-3"]
    );
    expect(plan).toEqual({ toDelete: ["s-2", "s-3"], toAttach: ["s-1"] });
  });

  // Interdit par l'index unique partiel `(sandbox_id, anon_id) WHERE user_id IS
  // NULL`, mais le plan reste total : migrer deux lignes sur le même sandbox
  // violerait `(sandbox_id, user_id)`.
  it("ne migre qu'une ligne par sandbox si deux lignes anonymes coexistaient", () => {
    const plan = planAnonAttach([anonStar("s-1", "sb-1"), anonStar("s-2", "sb-1")], [], []);
    expect(plan).toEqual({ toDelete: ["s-2"], toAttach: ["s-1"] });
  });
});
