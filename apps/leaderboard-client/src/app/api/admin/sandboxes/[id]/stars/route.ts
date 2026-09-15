import { NextResponse } from "next/server";
import {
  SandboxRepository,
  SandboxStarRepository,
} from "@packages/database-service/repositories";
import type { SandboxStar } from "@packages/database-service/domain/entities";
import { fetchContributorSession } from "@/lib/contributor";
import { moduleNotFoundResponse } from "@/lib/server/modules";

export const dynamic = "force-dynamic";

const sandboxRepo = new SandboxRepository();
const starRepo = new SandboxStarRepository();

/**
 * Audit et annulation des stars d'un sandbox — admin.
 *
 * Les paliers payés n'étant jamais repris automatiquement, une vague
 * frauduleuse doit pouvoir être défaite à la main. Ces deux handlers sont cet
 * outil : voir ce que le compteur public ne montre pas (lignes retirées,
 * lignes rattachées), puis supprimer.
 *
 * À savoir avant de nettoyer : si le compteur reste au-dessus d'un seuil après
 * coup, le palier sera **re-payé à la prochaine star**. L'index unique empêche
 * le doublon, pas la re-création — et le palier est alors légitime.
 */

/** Combien de caractères du haché d'IP sortent d'ici. */
const IP_HASH_PREFIX_LENGTH = 12;

/** Le jour d'une date, en UTC — la maille de regroupement de l'audit. */
function dayOf(date: Date | string): string {
  return new Date(date).toISOString().slice(0, 10);
}

/**
 * Une ligne de star telle que l'admin la lit.
 *
 * Ni `anon_id` (l'identifiant du navigateur, qui n'apprend rien à un humain),
 * ni `ip_hash` complet : seul un préfixe sort, assez pour reconnaître deux
 * lignes venues de la même adresse sans republier le haché lui-même. La
 * suppression se fait par `uuid`, que chaque groupe porte — le préfixe n'a donc
 * pas à être une clé.
 */
function toAuditRow(star: SandboxStar) {
  return {
    uuid: star.uuid,
    origin: star.origin,
    day: dayOf(star.created_at),
    ip_hash_prefix: star.ip_hash ? star.ip_hash.slice(0, IP_HASH_PREFIX_LENGTH) : null,
    is_account: star.user_id !== null,
    removed_at: star.removed_at ? star.removed_at.toISOString() : null,
    attached_at: star.attached_at ? star.attached_at.toISOString() : null,
    created_at: new Date(star.created_at).toISOString(),
  };
}

/**
 * GET /api/admin/sandboxes/[id]/stars — les lignes, brutes et groupées.
 *
 * Groupées par `(origin, ip_hash, jour)` : c'est la signature d'une vague
 * automatisée, qu'un tableau ligne à ligne noierait. Les lignes brutes suivent
 * quand même, parce que la suppression se fait par `uuid`.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = await moduleNotFoundResponse("sandbox");
  if (disabled) return disabled;

  const session = await fetchContributorSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const sandbox = await sandboxRepo.findById(id);
  if (!sandbox) return NextResponse.json({ error: "Sandbox not found" }, { status: 404 });

  const stars = await starRepo.findForAudit(id);
  const rows = stars.map(toAuditRow);

  const groups = new Map<
    string,
    {
      origin: string;
      day: string;
      ip_hash_prefix: string | null;
      count: number;
      active: number;
      attached: number;
      star_uuids: string[];
    }
  >();
  for (const row of rows) {
    const key = `${row.origin}|${row.ip_hash_prefix ?? "-"}|${row.day}`;
    const group = groups.get(key) ?? {
      origin: row.origin,
      day: row.day,
      ip_hash_prefix: row.ip_hash_prefix,
      count: 0,
      active: 0,
      attached: 0,
      star_uuids: [],
    };
    group.count += 1;
    if (!row.removed_at) group.active += 1;
    if (row.attached_at) group.attached += 1;
    group.star_uuids.push(row.uuid);
    groups.set(key, group);
  }

  return NextResponse.json({
    sandbox_id: id,
    star_count: rows.filter((row) => !row.removed_at).length,
    stars: rows,
    groups: [...groups.values()].sort((a, b) => (a.day < b.day ? 1 : -1)),
  });
}

/**
 * DELETE /api/admin/sandboxes/[id]/stars — suppression réelle, admin.
 *
 * Trois sélecteurs, cumulables : par liste d'`uuid`, par haché d'IP complet
 * (usage scripté — l'UI, qui n'en voit qu'un préfixe, passe par les `uuid`), ou
 * par fenêtre temporelle. Tous sont résolus contre les lignes de **ce**
 * sandbox : une erreur de saisie ne peut pas atteindre les stars d'un autre.
 *
 * Suppression réelle et non soft-delete : ces lignes n'ont jamais eu à exister,
 * il n'y a rien à conserver — c'est l'inverse d'un unstar de visiteur.
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = await moduleNotFoundResponse("sandbox");
  if (disabled) return disabled;

  const session = await fetchContributorSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const sandbox = await sandboxRepo.findById(id);
  if (!sandbox) return NextResponse.json({ error: "Sandbox not found" }, { status: 404 });

  const body = (await request.json().catch(() => null)) as {
    uuids?: unknown;
    ip_hash?: unknown;
    from?: unknown;
    to?: unknown;
  } | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const uuids = Array.isArray(body.uuids)
    ? body.uuids.filter((value): value is string => typeof value === "string")
    : [];
  const ipHash = typeof body.ip_hash === "string" ? body.ip_hash : null;
  const from = typeof body.from === "string" ? new Date(body.from) : null;
  const to = typeof body.to === "string" ? new Date(body.to) : null;
  if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime()))) {
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  }
  if (uuids.length === 0 && !ipHash && !from && !to) {
    return NextResponse.json(
      { error: "Provide uuids, ip_hash or a from/to window" },
      { status: 400 },
    );
  }

  // La résolution passe par les lignes du sandbox plutôt que par un DELETE
  // ciblé : le repository n'expose que `hardDelete(uuids)`, et c'est tant
  // mieux — un seul chemin de suppression, impossible d'en oublier la portée.
  const stars = await starRepo.findForAudit(id);
  const wanted = new Set(uuids);
  const targets = stars.filter((star) => {
    if (wanted.has(star.uuid)) return true;
    if (ipHash && star.ip_hash === ipHash) return true;
    if (from || to) {
      const created = new Date(star.created_at).getTime();
      if ((!from || created >= from.getTime()) && (!to || created <= to.getTime())) return true;
    }
    return false;
  });

  const deleted = await starRepo.hardDelete(targets.map((star) => star.uuid));
  const starCount = await starRepo.countActive(id);

  return NextResponse.json({ deleted, star_count: starCount });
}
