import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { DigestRepository } from "@packages/database-service/repositories";
import { fetchContributorSession } from "@/lib/contributor";

const digestRepo = new DigestRepository();

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function readInt(raw: string | null, fallback: number, max: number): number {
  const parsed = Number(raw);
  if (!raw || !Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.min(Math.floor(parsed), max);
}

export async function GET(request: Request) {
  const session = await fetchContributorSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const limit = readInt(searchParams.get("limit"), DEFAULT_LIMIT, MAX_LIMIT);
  const offset = readInt(searchParams.get("offset"), 0, Number.MAX_SAFE_INTEGER);

  const [digests, total] = await Promise.all([
    digestRepo.list(limit, offset),
    digestRepo.count(),
  ]);

  // La liste ne transporte pas les payloads : l'historique se déplie entrée par
  // entrée via /api/admin/digests/:id. Seuls les compteurs remontent, de quoi
  // rendre la ligne sans charger l'activité de toute la plateforme.
  return NextResponse.json({
    total,
    digests: digests.map((d) => ({
      uuid: d.uuid,
      period_start: d.period_start,
      period_end: d.period_end,
      generated_at: d.generated_at,
      trigger_source: d.trigger_source,
      counts: {
        new_contributions: d.payload?.new_contributions?.length ?? 0,
        new_challenges: d.payload?.new_challenges?.length ?? 0,
        completed_challenges: d.payload?.completed_challenges?.length ?? 0,
        new_contributors: d.payload?.new_contributors?.length ?? 0,
        cp_distributed: d.payload?.cp_distributed?.length ?? 0,
      },
    })),
  });
}
