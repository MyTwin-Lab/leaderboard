import "server-only";

import { readFileSync } from "node:fs";
import { join } from "node:path";

export type LegalDocument = "terms-of-use" | "privacy-policy";

/**
 * Le markdown vit dans `content/legal/`, hors de `public/` : les fichiers bruts
 * ne sont jamais servis tels quels, seules les pages rendues sont publiques.
 * Même emplacement et même découpage que sur mytwin-health-landing, dont ces
 * textes reprennent la structure.
 *
 * Lu depuis `process.cwd()` : le Procfile comme `next dev` lancent l'app depuis
 * `apps/leaderboard-client`.
 */
export function getLegalDocument(document: LegalDocument): string {
  return readFileSync(join(process.cwd(), "content", "legal", `${document}.md`), "utf8");
}
