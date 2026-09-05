import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { fetchContributorSession } from "@/lib/contributor";

export async function POST() {
  const session = await fetchContributorSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    // Même chemin de génération que le cron, en sautant seulement le contrôle
    // de fréquence : la fenêtre reste [dernier period_end, now], donc le
    // prochain digest automatique repart d'où celui-ci s'arrête.
    //
    // `digest_enabled` n'est volontairement pas consulté — le réglage gouverne
    // le cron, pas ce bouton (spec §8).
    const { DigestService } = await import(
      "../../../../../../../../packages/services/digest/digest.service.js"
    );
    const digest = await new DigestService().generate("manual");
    return NextResponse.json(digest, { status: 201 });
  } catch (error) {
    console.error("Error generating digest:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate digest" },
      { status: 500 },
    );
  }
}
