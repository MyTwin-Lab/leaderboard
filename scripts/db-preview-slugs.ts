import { db } from "../packages/database-service/db/drizzle.js";
import { sql } from "drizzle-orm";
import { SLUG_FALLBACK, planSlugBackfill } from "../packages/database-service/domain/slug.js";

/**
 * Aperçu, en lecture seule, des slugs que `db-apply-schema` attribuerait.
 *
 * À lancer contre une base avant d'y déployer les slugs, pour relire ce que
 * le backfill va écrire — typiquement la prod, à travers un tunnel :
 *
 *   scalingo --app <app> db-tunnel SCALINGO_POSTGRESQL_URL
 *   DATABASE_URL=postgres://…@127.0.0.1:10000/… npm run db:preview-slugs
 *
 * N'écrit rien, ne verrouille rien. Fonctionne que la colonne `slug` existe
 * déjà ou non : sans elle, toutes les lignes sont à remplir.
 */

async function hasColumn(table: string, column: string): Promise<boolean> {
  const { rows } = await db.execute(sql`
    SELECT 1 FROM information_schema.columns WHERE table_name = ${table} AND column_name = ${column}`);
  return rows.length > 0;
}

async function hasTable(table: string): Promise<boolean> {
  const { rows } = await db.execute(sql`SELECT to_regclass(${table}) IS NOT NULL AS present`);
  return rows[0]?.present === true;
}

async function preview(table: "challenges" | "sandboxes", redirectsTable: string, extra: string) {
  const slugColumn = (await hasColumn(table, "slug")) ? "slug" : "NULL::varchar AS slug";
  const { rows } = await db.execute(sql.raw(
    `SELECT uuid, title, ${slugColumn}, ${extra} FROM ${table} ORDER BY created_at, uuid`,
  ));
  const redirects = (await hasTable(redirectsTable))
    ? ((await db.execute(sql.raw(`SELECT slug FROM ${redirectsTable}`))).rows as Array<{ slug: string }>).map((r) => r.slug)
    : [];

  const typed = rows as Array<{ uuid: string; title: string; slug: string | null; status: string }>;
  const plan = new Map(
    planSlugBackfill(typed, table === "challenges" ? SLUG_FALLBACK.challenge : SLUG_FALLBACK.sandbox, redirects)
      .map(({ uuid, slug }) => [uuid, slug]),
  );

  console.log(`\n${table} — ${typed.length} lignes, ${plan.size} slug(s) à écrire`);
  for (const row of typed) {
    const next = plan.get(row.uuid);
    const shown = next ? `→ ${next}` : `= ${row.slug} (déjà posé)`;
    console.log(`  [${row.status}] ${row.title}\n      ${row.uuid} ${shown}`);
  }
}

async function main() {
  await preview("challenges", "challenge_slug_redirects", "status");
  await preview("sandboxes", "sandbox_slug_redirects", "status");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Aperçu impossible :", error);
    process.exit(1);
  });
