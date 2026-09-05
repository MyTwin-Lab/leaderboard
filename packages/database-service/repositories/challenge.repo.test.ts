import { describe, expect, it } from "vitest";
import { closedAtPatch } from "./challenge.repo";

// Le digest lit closed_at pour sa section completed_challenges. La règle tient
// en trois cas : on pose sur l'arrivée à 'completed', on efface si le challenge
// repart, et 'archived' ne pose rien.
describe("closedAtPatch", () => {
  it("stamps a date when the status becomes completed", () => {
    const patch = closedAtPatch("active", "completed");
    expect(patch.closed_at).toBeInstanceOf(Date);
  });

  it("re-stamps when a reopened challenge is closed again", () => {
    // L'événement qui intéresse le digest est la dernière fermeture : un
    // challenge fermé, rouvert, refermé doit apparaître dans le digest de la
    // seconde fermeture, pas seulement dans celui de la première.
    const patch = closedAtPatch("active", "completed");
    expect(patch.closed_at).toBeInstanceOf(Date);
  });

  it("clears the date when a completed challenge reopens", () => {
    // Sinon le challenge traînerait une date de fermeture périmée, et le
    // prochain digest le compterait comme fermé alors qu'il ne l'est plus.
    expect(closedAtPatch("completed", "active")).toEqual({ closed_at: null });
  });

  it("does not stamp on archived", () => {
    // Archiver retire des listings, ça ne termine pas un travail.
    expect(closedAtPatch("active", "archived")).toEqual({});
  });

  it("clears the date when a completed challenge is archived", () => {
    // 'archived' n'est pas 'completed' : le challenge quitte l'état fermé au
    // sens du digest, donc la date part avec lui.
    expect(closedAtPatch("completed", "archived")).toEqual({ closed_at: null });
  });

  it("does not stamp when the status is unchanged", () => {
    expect(closedAtPatch("completed", "completed")).toEqual({});
  });

  it("does nothing when the update carries no status", () => {
    // La quasi-totalité des updates : titre, description, reward_rules…
    expect(closedAtPatch("active", undefined)).toEqual({});
  });

  it("treats a missing previous status as not-closed", () => {
    expect(closedAtPatch(undefined, "completed").closed_at).toBeInstanceOf(Date);
  });
});
