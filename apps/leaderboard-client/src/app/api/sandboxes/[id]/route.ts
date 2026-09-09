import { NextRequest, NextResponse } from "next/server";
import {
  SandboxRepository,
  SandboxRewardRepository,
  SandboxStarRepository,
  UserRepository,
} from "../../../../../../../packages/database-service/repositories";
import { SandboxService } from "../../../../../../../packages/services/sandbox";
import { sandboxUpdateSchema } from "../../../../../../../packages/database-service/domain/schemas_zod";
import { verifyRequestToken } from "@/lib/auth";
import { readAnonId } from "@/lib/server/anonVisitor";
import { canSeeScore, canSeeSandbox, sandboxViewer, starIdentity } from "@/lib/server/sandboxAuth";
import { sandboxErrorResponse } from "@/lib/server/sandboxErrors";
import { toSandboxView } from "@/lib/public/sandbox";

export const dynamic = "force-dynamic";

const sandboxRepo = new SandboxRepository();
const starRepo = new SandboxStarRepository();
const rewardRepo = new SandboxRewardRepository();
const userRepo = new UserRepository();
const sandboxService = new SandboxService();

/**
 * GET /api/sandboxes/[id] — détail public.
 *
 * Un archivé répond 404 à qui n'en est ni l'auteur ni admin : le même code
 * qu'un identifiant inconnu, pour qu'on ne puisse pas déduire d'un 403
 * l'existence d'une proposition retirée.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const sandbox = await sandboxRepo.findById(id);
    if (!sandbox) return NextResponse.json({ error: "Sandbox not found" }, { status: 404 });

    const session = await verifyRequestToken(request);
    const viewer = sandboxViewer(
      session ? { userId: session.userId, role: session.role } : null,
      // Lecture seule : le cookie anonyme n'est jamais posé par un GET.
      await readAnonId(request),
    );
    if (!canSeeSandbox(sandbox, viewer)) {
      return NextResponse.json({ error: "Sandbox not found" }, { status: 404 });
    }

    const identity = starIdentity(viewer);
    const [author, starCount, paidMap, myStar, rewards] = await Promise.all([
      userRepo.findById(sandbox.user_id),
      starRepo.countActive(id),
      rewardRepo.paidTierThresholdsBySandboxIds([id]),
      identity
        ? identity.kind === "account"
          ? starRepo.findActiveForUser(id, identity.userId)
          : starRepo.findActiveForAnon(id, identity.anonId)
        : Promise.resolve(null),
      // Le ledger n'est chargé que pour qui a le droit de le lire — la vue
      // publique le laisserait tomber, mais autant ne pas payer la requête.
      canSeeScore(sandbox, viewer) ? rewardRepo.findBySandbox(id) : Promise.resolve(undefined),
    ]);

    return NextResponse.json({
      sandbox: toSandboxView({
        sandbox,
        viewer,
        author,
        starCount,
        myStar: myStar !== null,
        paidTierThresholds: paidMap.get(id) ?? [],
        rewards,
      }),
    });
  } catch (error) {
    console.error("[sandbox] detail failed", error);
    return NextResponse.json({ error: "Failed to fetch sandbox" }, { status: 500 });
  }
}

/**
 * PATCH /api/sandboxes/[id] — édition par l'auteur, ou archivage.
 *
 * Deux gestes sur le même verbe parce qu'ils portent sur la même ressource,
 * mais avec deux droits distincts (§1.6) : éditer est réservé à l'auteur,
 * archiver est ouvert à l'auteur pour le sien et à l'admin pour n'importe
 * lequel. `{ status: 'archived' }` bascule sur le second chemin ; `type` n'est
 * dans aucun des deux — il est figé à la création.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await verifyRequestToken(request);
  if (!session) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  try {
    let sandbox;

    if ("status" in body) {
      // Seul l'archivage passe par ce champ : `open` et `promoted` ont leurs
      // propres chemins (création, promotion), et désarchiver n'existe pas.
      if (body.status !== "archived") {
        return NextResponse.json(
          { error: "Only 'archived' can be set through this route" },
          { status: 400 },
        );
      }
      sandbox = await sandboxService.archive(id, {
        userId: session.userId,
        isAdmin: session.role === "admin",
      });
    } else {
      const parsed = sandboxUpdateSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Invalid body", details: parsed.error.flatten() },
          { status: 400 },
        );
      }
      sandbox = await sandboxService.update(id, session.userId, parsed.data);
    }

    const viewer = sandboxViewer({ userId: session.userId, role: session.role }, null);
    const [author, starCount, paidMap, myStar] = await Promise.all([
      userRepo.findById(sandbox.user_id),
      starRepo.countActive(id),
      rewardRepo.paidTierThresholdsBySandboxIds([id]),
      // Toujours nulle pour l'auteur (il ne peut pas starer le sien), mais pas
      // pour un admin qui archive le sandbox d'un autre après l'avoir staré :
      // renvoyer `false` en dur ferait sauter son étoile dans l'UI.
      starRepo.findActiveForUser(id, session.userId),
    ]);

    return NextResponse.json({
      sandbox: toSandboxView({
        sandbox,
        viewer,
        author,
        starCount,
        myStar: myStar !== null,
        paidTierThresholds: paidMap.get(id) ?? [],
      }),
    });
  } catch (error) {
    const mapped = sandboxErrorResponse(error);
    if (mapped) return mapped;
    console.error("[sandbox] update failed", error);
    return NextResponse.json({ error: "Failed to update sandbox" }, { status: 500 });
  }
}
