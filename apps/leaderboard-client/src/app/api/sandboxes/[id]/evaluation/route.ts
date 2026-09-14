import { NextRequest, NextResponse } from "next/server";
import { SandboxEvaluationService } from "../../../../../../../../packages/services/sandbox";
import { verifyRequestToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

const service = new SandboxEvaluationService();

/**
 * POST /api/sandboxes/[id]/evaluation
 *
 * Lance l'évaluation **formative** du repo de la proposition. Réservée à
 * l'auteur (§1.6) : c'est son miroir de travail, pas un classement public.
 *
 * Fire-and-forget comme `challenges/[id]/project-evaluation` : l'appel agent
 * dure des dizaines de secondes, le statut vit sur `sandboxes.evaluation_status`
 * et l'UI le poll. `202` dit « accepté, pas terminé ».
 *
 * Cette évaluation ne paie **aucun CP** — ni `reward_entries`, ni
 * `sandbox_rewards`, ni `contributions`. Les CP d'un sandbox viennent de ses
 * paliers de stars et de sa promotion, jamais de sa note.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRequestToken(request);
    if (!session) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

    const { id } = await params;
    const event = { sandboxId: id, userId: session.userId };

    // Le passage à `running` est attendu ici, avant le 202 : c'est ce
    // compare-and-set, et non une simple lecture du statut, qui fait qu'un
    // second lancement concurrent reçoit 409 au lieu de planifier un second
    // run (et un second appel LLM). `claim` porte aussi les préconditions.
    const claim = await service.claim(event);
    if (!claim.ok) {
      // 403 et non 404 pour un tiers : le détail d'un sandbox est public, son
      // existence n'est pas un secret — c'est le droit de lancer qui manque.
      // 409 quand un run est déjà en vol, comme project-evaluation.
      const status =
        claim.reason === "not_found"
          ? 404
          : claim.reason === "not_author"
            ? 403
            : claim.reason === "already_running"
              ? 409
              : 400;
      return NextResponse.json(
        { error: "Cannot start evaluation", reason: claim.reason },
        { status },
      );
    }

    service.scheduleRun(event);
    return NextResponse.json({ scheduled: true }, { status: 202 });
  } catch (error) {
    console.error("[sandbox] evaluation start failed", error);
    return NextResponse.json({ error: "Failed to start evaluation" }, { status: 500 });
  }
}
