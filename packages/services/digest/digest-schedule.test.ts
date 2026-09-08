import { describe, expect, it } from "vitest";
import { digestWindow, isDigestDue, startOfUtcDay } from "./digest-schedule.js";

const at = (iso: string) => new Date(iso);

describe("startOfUtcDay", () => {
  it("drops the time part", () => {
    expect(startOfUtcDay(at("2026-09-05T13:47:21.412Z")).toISOString())
      .toBe("2026-09-05T00:00:00.000Z");
  });

  it("leaves a date already on a boundary alone", () => {
    expect(startOfUtcDay(at("2026-09-05T00:00:00.000Z")).toISOString())
      .toBe("2026-09-05T00:00:00.000Z");
  });
});

describe("isDigestDue", () => {
  it("is due when no digest has ever been generated", () => {
    // Le tout premier digest ne peut pas attendre un curseur qui n'existe pas.
    expect(isDigestDue(null, at("2026-09-05T06:00:00Z"), 7)).toBe(true);
  });

  it("is due exactly on the frequency, whatever the time of day", () => {
    // Le cas qui fait dériver un comparateur sur timestamps : le period_end
    // porte quelques secondes de plus que l'heure du cron. Sur des frontières
    // de jour, l'écart vaut 7 jours pleins et le digest tombe à l'heure.
    expect(isDigestDue(at("2026-08-29T06:00:03Z"), at("2026-09-05T06:00:00Z"), 7)).toBe(true);
  });

  it("is not due one day early", () => {
    expect(isDigestDue(at("2026-08-29T00:00:00Z"), at("2026-09-04T23:59:59Z"), 7)).toBe(false);
  });

  it("is due past the frequency", () => {
    expect(isDigestDue(at("2026-06-05T06:00:00Z"), at("2026-09-05T06:00:00Z"), 7)).toBe(true);
  });

  it("does not drift over repeated cycles", () => {
    // Trois cycles enchaînés, chacun repartant du period_end du précédent, en
    // simulant un cron qui tourne toujours à 06:00 pile. Sur des timestamps
    // exacts, le premier tour renverrait déjà false et tout glisserait.
    let cursor = at("2026-08-29T06:00:03Z");
    for (const day of ["2026-09-05", "2026-09-12", "2026-09-19"]) {
      const now = at(`${day}T06:00:00Z`);
      expect(isDigestDue(cursor, now, 7)).toBe(true);
      cursor = digestWindow(cursor, now, 7).end;
    }
  });

  it("honours a daily frequency", () => {
    expect(isDigestDue(at("2026-09-04T23:00:00Z"), at("2026-09-05T01:00:00Z"), 1)).toBe(true);
    expect(isDigestDue(at("2026-09-05T01:00:00Z"), at("2026-09-05T23:00:00Z"), 1)).toBe(false);
  });

  it("stays due across a month boundary", () => {
    expect(isDigestDue(at("2026-08-30T06:00:00Z"), at("2026-09-06T06:00:00Z"), 7)).toBe(true);
  });
});

describe("digestWindow", () => {
  it("runs from the previous period_end to now", () => {
    const w = digestWindow(at("2026-08-29T06:00:03Z"), at("2026-09-05T06:00:00Z"), 7);
    expect(w.start.toISOString()).toBe("2026-08-29T06:00:03.000Z");
    expect(w.end.toISOString()).toBe("2026-09-05T06:00:00.000Z");
  });

  it("uses the frequency as a lookback for the very first digest", () => {
    const w = digestWindow(null, at("2026-09-05T06:00:00Z"), 7);
    expect(w.start.toISOString()).toBe("2026-08-29T06:00:00.000Z");
    expect(w.end.toISOString()).toBe("2026-09-05T06:00:00.000Z");
  });

  it("keeps exact timestamps, not day boundaries", () => {
    // Seule la décision "est-ce dû ?" se prend en jours. Les bornes de la
    // fenêtre restent exactes, sinon deux digests consécutifs se recouvriraient
    // ou laisseraient un trou de quelques heures.
    const w = digestWindow(at("2026-08-29T06:00:03Z"), at("2026-09-05T18:22:41Z"), 7);
    expect(w.end.toISOString()).toBe("2026-09-05T18:22:41.000Z");
  });

  it("produces a valid short window for a manual run right after a digest", () => {
    // Un "Generate now" juste après un digest automatique est légitime : la
    // fenêtre est courte et le digest sera majoritairement vide.
    const w = digestWindow(at("2026-09-05T06:00:00Z"), at("2026-09-05T06:05:00Z"), 7);
    expect(w.end.getTime()).toBeGreaterThan(w.start.getTime());
  });
});
