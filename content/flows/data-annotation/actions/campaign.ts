import { z } from "zod";
import type { ActionContext } from "../../../../packages/registry/platform.js";
import type { Challenge } from "../../../../packages/database-service/domain/entities.js";
import {
  RewardEntryRepository,
  UserRepository,
} from "../../../../packages/database-service/repositories/index.js";
import { resources, type ConsumedClaim } from "../../../../packages/capabilities/resources.js";
import { distributedFromPool, remainingPool } from "../../../../packages/capabilities/pool.js";
import {
  ANNOTATION_RULE_KEY,
  CLAWBACK_RULE_KEY,
  GOLD,
  ITEM,
  ITEM_CLASSES,
  annotationConfigOf,
  isOption,
  type AnnotationConfig,
} from "../config.js";
import { annotatorQuality, tallyOf, valueOf } from "../scoring.js";
import { parseCsv, toCsv } from "../csv.js";

/**
 * La campagne vue par l'admin ou le manager : importer les lots, suivre
 * l'avancement et la qualité, trancher les items contestés, exporter le jeu
 * labellisé. L'accès est déclaré dans `index.ts`.
 */

const res = resources();
const rewardRepo = new RewardEntryRepository();
const userRepo = new UserRepository();

/** Au-delà, un lot se découpe : l'import tient dans une seule requête. */
export const MAX_BATCH_ROWS = 5000;

function fail(status: number, error: string, details?: unknown): Response {
  return Response.json(details === undefined ? { error } : { error, details }, { status });
}

function configOrFail(challenge: Challenge): AnnotationConfig | Response {
  return annotationConfigOf(challenge) ?? fail(409, "This annotation challenge has no readable configuration");
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

const batchSchema = z.object({
  kind: z.enum(["items", "golds"]),
  csv: z.string().min(1),
});

type Row = { payload: Record<string, unknown>; class: string | null };

/** Les lignes d'un lot, validées toutes avant d'en écrire une seule. */
export function readBatch(
  kind: "items" | "golds",
  csv: string,
  config: AnnotationConfig
): { rows: Row[]; errors: string[] } {
  const records = parseCsv(csv);
  const rows: Row[] = [];
  const errors: string[] = [];

  if (records.length === 0) errors.push("The file has no data rows");
  if (records.length > MAX_BATCH_ROWS) errors.push(`At most ${MAX_BATCH_ROWS} rows per batch`);

  records.forEach((record, index) => {
    const line = index + 2; // l'en-tête est la ligne 1
    const imageUrl = record.image_url ?? "";
    if (!isHttpUrl(imageUrl)) {
      errors.push(`Line ${line}: image_url must be an http(s) URL`);
      return;
    }
    if (kind === "items") {
      const cls = record.class || "standard";
      if (!(ITEM_CLASSES as readonly string[]).includes(cls)) {
        errors.push(`Line ${line}: class must be one of ${ITEM_CLASSES.join(", ")}`);
        return;
      }
      rows.push({ payload: { image_url: imageUrl }, class: cls });
    } else {
      if (!isOption(config.label_schema, record.expected)) {
        errors.push(`Line ${line}: expected must be one of the label option keys`);
        return;
      }
      // `expected` ne quitte jamais le serveur : la carte servie ne lit que `image_url`.
      rows.push({ payload: { image_url: imageUrl, expected: record.expected }, class: null });
    }
  });

  return { rows, errors: errors.slice(0, 50) };
}

/**
 * `POST batches` — `{ kind: "items" | "golds", csv }`. Items : colonnes
 * `image_url` et `class` (facultative, `standard` par défaut). Golds :
 * `image_url` et `expected`. Tout ou rien.
 */
export async function importBatch({ request, challenge, user }: ActionContext) {
  const config = configOrFail(challenge);
  if (config instanceof Response) return config;

  const parsed = batchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail(400, "Expected { kind: 'items' | 'golds', csv }");

  const { rows, errors } = readBatch(parsed.data.kind, parsed.data.csv, config);
  if (errors.length > 0) return fail(400, "Invalid batch", errors);

  const type = parsed.data.kind === "items" ? ITEM : GOLD;
  const created = await res.createMany(challenge.uuid, type, rows, { createdBy: user.id });
  return { kind: parsed.data.kind, created };
}

function countOf(counts: Awaited<ReturnType<typeof res.counts>>, match: { type: string; state?: string; verdict?: string }) {
  return counts
    .filter((row) => row.type === match.type
      && (match.state === undefined || row.state === match.state)
      && (match.verdict === undefined || row.verdict === match.verdict))
    .reduce((sum, row) => sum + row.total, 0);
}

/**
 * `GET overview` — l'avancement de la campagne, la précision de chaque
 * annotateur (sans décalage : le manager voit tout), les items contestés et
 * l'état du pool.
 */
export async function overview({ challenge }: ActionContext) {
  const config = configOrFail(challenge);
  if (config instanceof Response) return config;

  const [counts, consumed, contested, distributed, entries] = await Promise.all([
    res.counts(challenge.uuid),
    res.consumedBy({ challengeId: challenge.uuid }),
    res.list({ challengeId: challenge.uuid, type: ITEM, verdict: "contested" }),
    distributedFromPool(rewardRepo, challenge.uuid),
    rewardRepo.findByChallenge(challenge.uuid),
  ]);

  const byUser = new Map<string, ConsumedClaim[]>();
  for (const claim of consumed) byUser.set(claim.user_id, [...(byUser.get(claim.user_id) ?? []), claim]);
  const cpByUser = new Map<string, number>();
  for (const entry of entries) {
    if (entry.rule_key !== ANNOTATION_RULE_KEY && entry.rule_key !== CLAWBACK_RULE_KEY) continue;
    cpByUser.set(entry.user_id, (cpByUser.get(entry.user_id) ?? 0) + entry.points);
  }
  const users = byUser.size > 0 ? await userRepo.findByIds([...byUser.keys()]) : [];
  const names = new Map(users.map((u) => [u.uuid, u.full_name]));

  const valuesByResource = new Map<string, string[]>();
  for (const claim of consumed) {
    const value = valueOf(claim);
    if (value !== null) valuesByResource.set(claim.resource_id, [...(valuesByResource.get(claim.resource_id) ?? []), value]);
  }

  return {
    items: {
      total: countOf(counts, { type: ITEM }),
      open: countOf(counts, { type: ITEM, state: "open" }),
      labeled: countOf(counts, { type: ITEM, verdict: "labeled" }),
      contested: countOf(counts, { type: ITEM, verdict: "contested" }),
    },
    golds: countOf(counts, { type: GOLD }),
    k: config.k,
    options: config.label_schema.options,
    pool: {
      pool: challenge.contribution_points_reward,
      distributed,
      remaining: remainingPool(challenge.contribution_points_reward, distributed),
    },
    annotators: [...byUser.entries()]
      .map(([userId, claims]) => {
        const quality = annotatorQuality(claims, 0);
        return {
          user_id: userId,
          name: names.get(userId) ?? "Unknown",
          labels: claims.length,
          gold_seen: quality.goldSeen,
          gold_correct: quality.goldCorrect,
          accuracy: quality.accuracy,
          cp: cpByUser.get(userId) ?? 0,
        };
      })
      .sort((a, b) => b.labels - a.labels),
    contested: contested.map((item) => ({
      resource_id: item.uuid,
      image_url: typeof item.payload.image_url === "string" ? item.payload.image_url : null,
      tally: tallyOf(valuesByResource.get(item.uuid) ?? []),
    })),
  };
}

const resolveSchema = z.object({ value: z.string() });

/** `POST items/:resourceId/resolve` — tranche un item contesté à la main. */
export async function resolveItem({ request, challenge, user, params }: ActionContext) {
  const config = configOrFail(challenge);
  if (config instanceof Response) return config;

  const parsed = resolveSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !isOption(config.label_schema, parsed.data.value)) {
    return fail(400, "value must be one of the label options");
  }

  const item = await res.resource(params.resourceId);
  if (!item || item.challenge_id !== challenge.uuid || item.resource_type !== ITEM) return fail(404, "Item not found");

  const resolved = await res.reclose(item.uuid, "contested", "labeled", {
    consensus: parsed.data.value,
    resolved_by: user.id,
    resolved_at: new Date().toISOString(),
  });
  if (!resolved) return fail(409, "This item is not contested");
  return { resource_id: resolved.uuid, verdict: resolved.verdict, consensus: parsed.data.value };
}

/** `GET export` — le produit de la campagne : un CSV des items fermés. */
export async function exportLabels({ challenge }: ActionContext) {
  const [closed, consumed] = await Promise.all([
    res.list({ challengeId: challenge.uuid, type: ITEM, state: "closed" }),
    res.consumedBy({ challengeId: challenge.uuid, type: ITEM }),
  ]);

  const labels = new Map<string, number>();
  for (const claim of consumed) labels.set(claim.resource_id, (labels.get(claim.resource_id) ?? 0) + 1);

  const csv = toCsv(
    ["image_url", "consensus", "k", "contested"],
    closed.map((item) => [
      typeof item.payload.image_url === "string" ? item.payload.image_url : "",
      typeof item.resolution?.consensus === "string" ? item.resolution.consensus : "",
      labels.get(item.uuid) ?? 0,
      item.verdict === "contested",
    ])
  );

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="annotations-${challenge.slug || challenge.uuid}.csv"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
