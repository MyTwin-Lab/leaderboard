import { readFileSync, readdirSync } from "fs";
import { and, eq, isNull, or } from "drizzle-orm";
import { db, challenges, challenge_documents } from "../packages/database-service/db/drizzle.js";

/**
 * Ce qu'un challenge porte en propre sur sa page publique et que les tables du
 * seed ne décrivent pas : son brief, et qui l'héberge.
 *
 * Les deux se retrouvent par le **slug** du challenge, seul identifiant stable
 * d'un seed à l'autre et lisible dans l'URL de la page.
 */

/**
 * Les briefs des challenges — un fichier Markdown par challenge, dans
 * `db_data/briefs/`, nommé d'après son **slug**.
 *
 * Un brief est un document comme un autre : il vit dans `challenge_documents`
 * sous le nom `brief.md`, sans colonne dédiée (voir
 * `apps/leaderboard-client/src/lib/challengeBrief.ts`, d'où vient la
 * constante). Le seed n'a donc rien de spécial à écrire, juste une ligne de
 * document de plus.
 *
 * Le slug plutôt que l'index ou le titre : c'est le seul identifiant stable
 * qu'un challenge porte aussi bien après le seed de base qu'après les seeds de
 * démonstration, et il se lit dans l'URL de la page. Un fichier dont le slug ne
 * désigne rien est simplement passé — c'est ce qui permet à cette fonction
 * d'être appelée par les trois seeds sans qu'aucun n'ait à savoir quels
 * challenges les deux autres créent.
 *
 * Additif comme le reste de `seed.ts` : un challenge qui a déjà un brief garde
 * le sien, celui de l'admin n'est jamais réécrit.
 */

const BRIEFS_DIR = "./db_data/briefs";

/**
 * Le nom qui fait d'un document un brief. Écrit ici et non importé de
 * `apps/leaderboard-client/src/lib/challengeBrief.ts`, qui en est la source de
 * vérité pour l'app : ce seed tourne sous tsx depuis la racine, et rien n'y
 * résout un module de l'app Next. Si ce nom change là-bas, il change ici.
 */
const BRIEF_FILENAME = "brief.md";

export async function seedBriefs(): Promise<{ inserted: number; kept: number; orphans: string[] }> {
  const files = readdirSync(BRIEFS_DIR).filter((f) => f.endsWith(".md"));

  let inserted = 0;
  let kept = 0;
  const orphans: string[] = [];

  for (const file of files) {
    const slug = file.replace(/\.md$/, "");

    const [challenge] = await db
      .select({ uuid: challenges.uuid })
      .from(challenges)
      .where(eq(challenges.slug, slug))
      .limit(1);

    if (!challenge) {
      orphans.push(slug);
      continue;
    }

    const [existing] = await db
      .select({ uuid: challenge_documents.uuid })
      .from(challenge_documents)
      .where(and(
        eq(challenge_documents.challenge_id, challenge.uuid),
        eq(challenge_documents.filename, BRIEF_FILENAME),
      ))
      .limit(1);

    if (existing) {
      kept++;
      continue;
    }

    await db.insert(challenge_documents).values({
      challenge_id: challenge.uuid,
      filename: BRIEF_FILENAME,
      content: readFileSync(`${BRIEFS_DIR}/${file}`, "utf-8"),
    });
    inserted++;
  }

  return { inserted, kept, orphans };
}

/**
 * `seedBriefs` et sa ligne de log, appelés tels quels par les trois seeds.
 *
 * Ici plutôt que dans `seed.ts` : ce module-là exécute son `main()` au
 * chargement, donc l'importer depuis un autre seed le ferait tourner en entier.
 */
export async function logBriefs() {
  const { inserted, kept, orphans } = await seedBriefs();
  console.log(`✓ Briefs: ${inserted} inserted, ${kept} already written`);
  // Un fichier dont le slug ne désigne rien n'est pas une erreur : c'est un
  // challenge qu'un autre seed créera, ou pas du tout. On le dit quand même,
  // sinon un slug mal orthographié passerait inaperçu.
  if (orphans.length > 0) console.log(`  (no challenge yet for: ${orphans.join(", ")})`);
}

/**
 * Qui porte chaque challenge — `challenges.host`, la carte « Who hosts this
 * challenge » de la page publique.
 *
 * **Données de démonstration, et seulement ça.** Contrairement aux briefs,
 * cette fonction n'est pas appelée par `seed.ts` : ce seed-là tourne aussi
 * contre la production (voir `scripts/prod.sh`, `db:setup`, `populate-db`), et
 * `db_data/hosts.json` cite des établissements réels en exemple. Écrire le nom
 * d'un CHU sur la page publique d'un challenge qu'il n'héberge pas n'est pas
 * une donnée de test, c'est une affiliation inventée. En production, l'hôte se
 * saisit dans le tiroir d'administration.
 *
 * Additif comme le reste : un challenge qui a déjà un hôte garde le sien.
 */
export async function seedHosts(): Promise<{ set: number; kept: number; orphans: string[] }> {
  const hosts: Record<string, string> = JSON.parse(readFileSync("./db_data/hosts.json", "utf-8"));

  let set = 0;
  let kept = 0;
  const orphans: string[] = [];

  for (const [slug, host] of Object.entries(hosts)) {
    // La clé de commentaire du fichier JSON n'est pas un slug.
    if (slug.startsWith("_")) continue;

    // Vide compte comme absent : un `host` mis à `''` n'a jamais été saisi.
    const updated = await db
      .update(challenges)
      .set({ host })
      .where(and(eq(challenges.slug, slug), or(isNull(challenges.host), eq(challenges.host, ""))))
      .returning({ uuid: challenges.uuid });

    if (updated.length > 0) {
      set++;
      continue;
    }

    const [exists] = await db
      .select({ uuid: challenges.uuid })
      .from(challenges)
      .where(eq(challenges.slug, slug))
      .limit(1);
    if (exists) kept++;
    else orphans.push(slug);
  }

  return { set, kept, orphans };
}

/** `seedHosts` et sa ligne de log, comme `logBriefs` pour les briefs. */
export async function logHosts() {
  const { set, kept, orphans } = await seedHosts();
  console.log(`✓ Hosts: ${set} set, ${kept} already filled in`);
  if (orphans.length > 0) console.log(`  (no challenge yet for: ${orphans.join(", ")})`);
}
