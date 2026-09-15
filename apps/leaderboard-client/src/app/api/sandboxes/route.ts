import { NextRequest, NextResponse } from "next/server";
import {
  ChallengeRepository,
  SandboxRepository,
  SandboxRewardRepository,
  SandboxStarRepository,
  UserRepository,
} from "../../../../../../packages/database-service/repositories";
import {
  SANDBOX_MODULE,
  SandboxService,
  proposalFieldsInput,
  readSandboxSettings,
} from "../../../../../../packages/services/sandbox";
import { sandboxCreateSchema } from "../../../../../../packages/database-service/domain/schemas_zod";
import { verifyRequestToken } from "@/lib/auth";
import { readAnonId } from "@/lib/server/anonVisitor";
import { moduleNotFoundResponse } from "@/lib/server/modules";
import { canCreateSandbox, canSeeSandbox, sandboxViewer, starIdentity } from "@/lib/server/sandboxAuth";
import { sandboxErrorResponse } from "@/lib/server/sandboxErrors";
import { toSandboxView } from "@/lib/public/sandbox";

export const dynamic = "force-dynamic";

const sandboxRepo = new SandboxRepository();
const challengeRepo = new ChallengeRepository();
const starRepo = new SandboxStarRepository();
const rewardRepo = new SandboxRewardRepository();
const userRepo = new UserRepository();
const sandboxService = new SandboxService();

/**
 * GET /api/sandboxes — listing public.
 *
 * **`proxy.ts` n'a rien à faire ici, et ce n'est pas un oubli.**
 * `/api/sandboxes/**` est volontairement hors du `matcher` du proxy, comme
 * `/api/admin/*` : le listing et le détail sont publics, la création est
 * réservée à trois rôles, et le star est ouvert aux visiteurs anonymes. Une
 * garde par préfixe ne sait pas exprimer ça — chaque handler fait donc sa
 * propre authentification, en lisant la session via `verifyRequestToken`.
 *
 * Conséquence à connaître : hors du matcher, un access_token expiré n'est pas
 * rafraîchi ici. Les pages sandbox montent le même `meQuery`
 * (`/api/contributors/me`, lui dans le matcher) que `challenges/[id]` — c'est
 * ce fetch qui déclenche le refresh silencieux, sans quoi un utilisateur
 * connecté au jeton expiré passerait pour un anonyme.
 */
export async function GET(request: NextRequest) {
  const disabled = await moduleNotFoundResponse(SANDBOX_MODULE);
  if (disabled) return disabled;

  try {
    const session = await verifyRequestToken(request);
    const viewer = sandboxViewer(
      session ? { userId: session.userId, role: session.role } : null,
      // Lecture seule : jamais d'émission de cookie sur un GET.
      await readAnonId(request),
    );

    // Chargés avec les archivés, puis filtrés ici : la visibilité d'un archivé
    // dépend du lecteur (auteur ou admin), ce que le repository ne connaît pas.
    const all = await sandboxRepo.findAll({ includeArchived: true });
    const visible = all.filter((sandbox) => canSeeSandbox(sandbox, viewer));
    const ids = visible.map((sandbox) => sandbox.uuid);
    const promotedIds = [
      ...new Set(visible.flatMap((sandbox) => (sandbox.promoted_challenge_id ? [sandbox.promoted_challenge_id] : []))),
    ];

    const [counts, paidMap, authors, settings, promotedChallenges] = await Promise.all([
      starRepo.countActiveBySandboxIds(ids),
      rewardRepo.paidTierThresholdsBySandboxIds(ids),
      userRepo.findByIds([...new Set(visible.map((sandbox) => sandbox.user_id))]),
      readSandboxSettings(),
      // La carte d'une proposition promue mène au challenge : il faut son slug.
      challengeRepo.findByIds(promotedIds),
    ]);
    const authorById = new Map(authors.map((author) => [author.uuid, author]));
    const promotedSlugById = new Map(promotedChallenges.map((challenge) => [challenge.uuid, challenge.slug]));

    const myStars = await resolveMyStars(ids, viewer);

    return NextResponse.json({
      sandboxes: visible.map((sandbox) =>
        toSandboxView({
          sandbox,
          viewer,
          author: authorById.get(sandbox.user_id) ?? null,
          starCount: counts.get(sandbox.uuid) ?? 0,
          myStar: myStars.has(sandbox.uuid),
          paidTierThresholds: paidMap.get(sandbox.uuid) ?? [],
          promotedChallengeSlug: sandbox.promoted_challenge_id
            ? promotedSlugById.get(sandbox.promoted_challenge_id) ?? null
            : null,
        }),
      ),
      // Les paliers et le bonus sont la règle du jeu affichée : publics, et
      // inertes tant que l'admin n'a rien configuré.
      tiers: settings.star_tiers,
      promotion_bonus_cp: settings.promotion_bonus_cp,
    });
  } catch (error) {
    console.error("[sandbox] listing failed", error);
    return NextResponse.json({ error: "Failed to fetch sandboxes" }, { status: 500 });
  }
}

/**
 * POST /api/sandboxes — création.
 *
 * `admin` et `contributor` (§1.6). `viewer` est exclu : c'est le
 * rôle sans aucun droit d'écriture. Un manager n'a rien de particulier ici — il
 * crée en tant que contributeur, comme tout le monde.
 *
 * `type` est la clé d'un flow proposable ; le reste du corps (dépôt, datasets…)
 * est validé par le schéma de ce flow, dans le service.
 */
export async function POST(request: NextRequest) {
  const disabled = await moduleNotFoundResponse(SANDBOX_MODULE);
  if (disabled) return disabled;

  const session = await verifyRequestToken(request);
  if (!session) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!canCreateSandbox(session.role)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = sandboxCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const created = await sandboxService.create({
      user_id: session.userId,
      type: parsed.data.type,
      title: parsed.data.title,
      slug: parsed.data.slug,
      context: parsed.data.context ?? null,
      goals: parsed.data.goals,
      why: parsed.data.why ?? null,
      fields: proposalFieldsInput(body),
    });

    const viewer = sandboxViewer({ userId: session.userId, role: session.role }, null);
    const author = await userRepo.findById(session.userId);

    return NextResponse.json(
      {
        sandbox: toSandboxView({
          sandbox: created,
          viewer,
          author,
          starCount: 0,
          myStar: false,
          paidTierThresholds: [],
        }),
      },
      { status: 201 },
    );
  } catch (error) {
    const mapped = sandboxErrorResponse(error);
    if (mapped) return mapped;
    console.error("[sandbox] creation failed", error);
    return NextResponse.json({ error: "Failed to create sandbox" }, { status: 500 });
  }
}

/**
 * Les sandboxes que le lecteur a starés, parmi ceux affichés.
 *
 * Une requête par sandbox, faute de lecture groupée dans le repository — le
 * coût est borné par le volume attendu du listing (quelques dizaines), le même
 * qui rend acceptable le tri « Most starred » côté client (§4.5 du plan). Un
 * visiteur sans identité (jamais staré, donc sans cookie) n'en déclenche
 * aucune : c'est le cas le plus fréquent.
 */
async function resolveMyStars(
  sandboxIds: string[],
  viewer: ReturnType<typeof sandboxViewer>,
): Promise<Set<string>> {
  const identity = starIdentity(viewer);
  if (!identity || sandboxIds.length === 0) return new Set();

  const found = await Promise.all(
    sandboxIds.map(async (id) => {
      const star =
        identity.kind === "account"
          ? await starRepo.findActiveForUser(id, identity.userId)
          : await starRepo.findActiveForAnon(id, identity.anonId);
      return star ? id : null;
    }),
  );
  return new Set(found.filter((id): id is string => id !== null));
}
