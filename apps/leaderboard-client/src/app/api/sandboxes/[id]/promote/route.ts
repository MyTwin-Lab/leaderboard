import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { SandboxPromotionService } from "../../../../../../../../packages/services/sandbox";
import { parseMlRewardRules } from "../../../../../../../../packages/database-service/domain/mlRewardRules";
import { parseCodeRewardRules } from "../../../../../../../../packages/database-service/domain/codeRewardRules";
import { verifyRequestToken } from "@/lib/auth";
import { sandboxErrorResponse } from "@/lib/server/sandboxErrors";

export const dynamic = "force-dynamic";

const service = new SandboxPromotionService();

/**
 * Le corps du POST, c'est `createChallengeSchema` **moins ce qui est décidé
 * ailleurs** :
 *
 * - `type` — hérité de la proposition, immuable (le tiroir verrouille le
 *   sélecteur, `buildPromotedChallengeDraft` le garantit côté serveur) ;
 * - `workspace_mode` et `github_repo` — un sandbox `code` devient forcément un
 *   challenge `own_repo` sur le dépôt de son auteur, il n'y a pas de repo
 *   partagé à saisir ;
 * - `source_challenge_id`, `cp_per_validation`, `required_validations` — propres
 *   aux challenges de validation, qui dérivent d'un challenge ML existant et ne
 *   peuvent pas naître d'une proposition.
 *
 * Tout le reste (projet, statut, dates, pool, règles de reward, compute, API
 * packaging, brief) reste à la main de l'admin.
 */
const promoteSchema = z.object({
  title: z.string().min(1).optional(),
  status: z.string(),
  start_date: z.string().nullish(),
  end_date: z.string().nullish(),
  description: z.string().optional(),
  roadmap: z.string().optional(),
  contribution_points_reward: z.number().int().nonnegative(),
  project_id: z.string().uuid(),
  reward_rules: z.unknown().nullish(),
  compute_enabled: z.boolean().optional(),
  api_packaging_enabled: z.boolean().optional(),
});

/**
 * POST /api/sandboxes/[id]/promote — **admin uniquement** (§1.6).
 *
 * Un manager est rattaché à un projet ; un sandbox n'en a pas, donc il n'a
 * aucun droit particulier ici — c'est délibéré, pas un oubli.
 *
 * `409` quand la proposition n'est plus `open` : elle a déjà été promue (ou
 * archivée). C'est la garde en tête de transaction qui le dit, pas une lecture
 * préalable — deux POST concurrents ne peuvent pas produire deux challenges.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRequestToken(request);
    if (!session) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    if (session.role !== "admin") {
      return NextResponse.json({ error: "Only an admin can promote a sandbox" }, { status: 403 });
    }

    const { id } = await params;

    const body = await request.json().catch(() => null);
    const parsed = promoteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid body", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    // Même validation qu'à la création d'un challenge : des règles illisibles
    // seraient stockées telles quelles et le scoring ne trouverait rien.
    const rewardRules =
      parsed.data.reward_rules == null
        ? null
        : parseMlRewardRules(parsed.data.reward_rules) ?? parseCodeRewardRules(parsed.data.reward_rules);
    if (parsed.data.reward_rules != null && !rewardRules) {
      return NextResponse.json({ error: "Invalid reward_rules" }, { status: 400 });
    }

    const { challenge } = await service.promote({
      sandboxId: id,
      actor: { userId: session.userId, role: session.role },
      input: { ...parsed.data, reward_rules: rewardRules },
    });

    // La forme de la réponse est celle de `POST /api/challenges` : le tiroir
    // lit `uuid` pour naviguer vers le challenge fraîchement créé.
    return NextResponse.json(challenge, { status: 201 });
  } catch (error) {
    const mapped = sandboxErrorResponse(error);
    if (mapped) return mapped;
    console.error("[sandbox] promotion failed", error);
    return NextResponse.json({ error: "Failed to promote sandbox" }, { status: 500 });
  }
}
