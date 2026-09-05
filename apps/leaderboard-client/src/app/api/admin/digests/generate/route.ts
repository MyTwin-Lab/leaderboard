import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { fetchContributorSession } from "@/lib/contributor";
import { DigestService } from "../../../../../../../../packages/services/digest/digest.service.js";

/** `2026-09-01` — ce qu'envoie un `<input type="date">`. */
const PLAIN_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Lit la borne basse choisie dans l'onglet.
 *
 * Une date nue est lue à minuit **UTC** et non dans le fuseau du navigateur :
 * sinon la borne dériverait d'un lecteur à l'autre, pour un champ qui ne porte
 * pourtant aucune heure.
 */
function parsePeriodStart(raw: unknown): Date | null | "invalid" {
  if (raw === undefined || raw === null || raw === "") return null;
  if (typeof raw !== "string") return "invalid";

  const parsed = new Date(PLAIN_DATE.test(raw) ? `${raw}T00:00:00.000Z` : raw);
  if (Number.isNaN(parsed.getTime())) return "invalid";
  if (parsed.getTime() >= Date.now()) return "invalid";
  return parsed;
}

export async function POST(request: Request) {
  const session = await fetchContributorSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Le bouton peut poster sans corps : ça vaut « depuis le curseur ».
  const body = await request.json().catch(() => ({}));
  const periodStart = parsePeriodStart(body?.period_start);
  if (periodStart === "invalid") {
    return NextResponse.json(
      { error: "period_start must be a past date" },
      { status: 400 },
    );
  }

  try {
    // Même chemin de génération que le cron, en sautant seulement le contrôle
    // de fréquence. `period_end` vaut toujours `now`, donc le prochain digest
    // automatique repart d'ici même quand une borne basse a été imposée.
    //
    // `digest_enabled` n'est volontairement pas consulté — le réglage gouverne
    // le cron, pas ce bouton (spec §8).
    const digest = await new DigestService().generate(
      "manual",
      periodStart ? { periodStart } : {},
    );
    return NextResponse.json(digest, { status: 201 });
  } catch (error) {
    console.error("Error generating digest:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate digest" },
      { status: 500 },
    );
  }
}
