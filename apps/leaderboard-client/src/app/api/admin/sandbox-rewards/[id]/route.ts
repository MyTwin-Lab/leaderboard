import { NextResponse } from "next/server";
import { SandboxRewardRepository } from "@packages/database-service/repositories";
import { fetchContributorSession } from "@/lib/contributor";

export const dynamic = "force-dynamic";

const rewardRepo = new SandboxRewardRepository();

/**
 * DELETE /api/admin/sandbox-rewards/[id] — reprise d'une ligne du ledger.
 *
 * C'est *aussi* la reprise des CP : le total sandbox d'un contributeur est un
 * `SUM(points)` en direct, sans colonne de cache, donc le classement baisse
 * immédiatement et il n'y a aucun resync à programmer.
 *
 * À savoir : si le compteur de stars reste au-dessus du seuil, le palier sera
 * re-payé à la prochaine star. Supprimer la reward sans nettoyer les stars
 * frauduleuses ne fait donc que retarder le paiement — les deux gestes vont
 * ensemble.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await fetchContributorSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const deleted = await rewardRepo.delete(id);
  if (!deleted) return NextResponse.json({ error: "Reward not found" }, { status: 404 });

  return NextResponse.json({ success: true });
}
