import { NextRequest, NextResponse } from "next/server";
import {
  SandboxRepository,
  SandboxRewardRepository,
  SandboxStarRepository,
} from "../../../../../../../../packages/database-service/repositories";
import {
  SandboxNotFoundError,
  SandboxService,
} from "../../../../../../../../packages/services/sandbox";
import type { StarState } from "../../../../../../../../packages/services/sandbox";
import { verifyRequestToken } from "@/lib/auth";
import { issueAnonCookie, newAnonId, readAnonId } from "@/lib/server/anonVisitor";
import { clientIpHash } from "@/lib/server/clientIp";
import { sandboxViewer, starIdentity } from "@/lib/server/sandboxAuth";
import { sandboxErrorResponse } from "@/lib/server/sandboxErrors";

export const dynamic = "force-dynamic";

const sandboxRepo = new SandboxRepository();
const starRepo = new SandboxStarRepository();
const rewardRepo = new SandboxRewardRepository();
const sandboxService = new SandboxService();

/** La même forme pour les deux verbes : l'UI n'a qu'un état à recâbler. */
function starPayload(state: StarState) {
  return {
    star_count: state.starCount,
    my_star: state.myStar,
    // Lu dans `sandbox_rewards`, jamais déduit du compteur : le rattachement
    // d'une identité anonyme peut faire repasser `star_count` sous un seuil
    // déjà payé, et un palier n'est jamais repris.
    paid_tier_thresholds: state.paidTierThresholds,
  };
}

/**
 * PUT /api/sandboxes/[id]/star — star, public.
 *
 * L'identité vient de la session si elle existe, sinon du cookie `sb_anon` —
 * et c'est **le seul endroit** qui en émet un, quand la requête n'en porte
 * pas. Jamais sur un GET : un simple lecteur ne repart pas avec un cookie.
 *
 * Les refus viennent du service, qui porte les règles : 403 pour l'auteur,
 * 409 pour un sandbox qui n'est plus `open`, 429 pour le plafond horaire des
 * stars anonymes.
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const session = await verifyRequestToken(request);
    const existingAnonId = await readAnonId(request);

    // Un visiteur non connecté et sans cookie reçoit son identité maintenant :
    // sans elle, l'unicité par sandbox n'aurait rien sur quoi s'appuyer.
    const issuedAnonId = session || existingAnonId ? null : newAnonId();
    const viewer = sandboxViewer(
      session ? { userId: session.userId, role: session.role } : null,
      existingAnonId ?? issuedAnonId,
    );

    const identity = starIdentity(viewer);
    if (!identity) {
      // Inatteignable : sans session, `issuedAnonId` en fabrique toujours une.
      return NextResponse.json({ error: "No star identity" }, { status: 400 });
    }

    const state = await sandboxService.star(id, identity, clientIpHash(request));

    const response = NextResponse.json(starPayload(state));
    if (issuedAnonId) await issueAnonCookie(response, issuedAnonId);
    return response;
  } catch (error) {
    const mapped = sandboxErrorResponse(error);
    if (mapped) return mapped;
    console.error("[sandbox] star failed", error);
    return NextResponse.json({ error: "Failed to star sandbox" }, { status: 500 });
  }
}

/**
 * DELETE /api/sandboxes/[id]/star — unstar, public.
 *
 * Soft-delete côté service, et **rien n'est repris** : le palier déjà payé
 * reste payé. Aucun cookie n'est émis ici — sans identité, il n'y a rien à
 * retirer, et poser un cookie sur un unstar reviendrait à en poser un sur une
 * requête qui n'écrit rien.
 *
 * Idempotent jusqu'au bout : un appel sans identité renvoie l'état courant
 * plutôt qu'une erreur, parce qu'« aucune star à retirer » est exactement le
 * résultat que l'appelant demandait.
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const session = await verifyRequestToken(request);
    const viewer = sandboxViewer(
      session ? { userId: session.userId, role: session.role } : null,
      await readAnonId(request),
    );

    const identity = starIdentity(viewer);
    if (!identity) return NextResponse.json(starPayload(await readOnlyState(id)));

    const state = await sandboxService.unstar(id, identity);
    return NextResponse.json(starPayload(state));
  } catch (error) {
    const mapped = sandboxErrorResponse(error);
    if (mapped) return mapped;
    console.error("[sandbox] unstar failed", error);
    return NextResponse.json({ error: "Failed to unstar sandbox" }, { status: 500 });
  }
}

/** L'état d'un sandbox sans rien écrire, pour un unstar qui n'a rien à retirer. */
async function readOnlyState(sandboxId: string): Promise<StarState> {
  const sandbox = await sandboxRepo.findById(sandboxId);
  if (!sandbox) {
    // Relayé en 404 par `sandboxErrorResponse`, comme n'importe quel autre
    // chemin — le service lève la même erreur pour un identifiant inconnu.
    throw new SandboxNotFoundError(sandboxId);
  }

  const [starCount, paidMap] = await Promise.all([
    starRepo.countActive(sandboxId),
    rewardRepo.paidTierThresholdsBySandboxIds([sandboxId]),
  ]);
  return { starCount, myStar: false, paidTierThresholds: paidMap.get(sandboxId) ?? [] };
}
