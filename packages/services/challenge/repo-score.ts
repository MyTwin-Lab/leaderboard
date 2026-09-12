/**
 * Helpers purs du pipeline d'évaluation de repo.
 * ----------------------------------------------
 * Deux fonctions, aucune dépendance — et c'est la raison d'être du fichier.
 *
 * `repo-evaluation.ts` tire le connecteur GitHub (octokit), l'évaluateur
 * OpenAI et `fs` : il ne peut pas entrer dans un bundle navigateur. Or les
 * composants client du sandbox (`components/sandbox/`) ont besoin de la même
 * conversion /9 → /10 pour afficher un score déjà stocké. Isoler ici ce qui est
 * pur laisse `repo-evaluation.ts` les ré-exporter côté serveur — un seul calcul,
 * deux chemins d'import.
 */

/**
 * Parse `owner/repo` (+ branche optionnelle) depuis une URL GitHub — repo
 * racine, suffixe `.git` ou `/tree/<branch>`.
 *
 * Distinct de `lib/githubUrl.ts`, qui lit des URLs de pull request et de
 * commit : ici on ne s'intéresse qu'au dépôt lui-même.
 */
export function parseGithubRepoUrl(url?: string): { slug: string; branch?: string } | null {
  if (!url) return null;
  const m = url.match(/github\.com\/([^/?#]+)\/([^/?#]+?)(?:\.git)?(?:\/tree\/([^?#]+))?(?:[?#]|$)/);
  if (!m) return null;
  return { slug: `${m[1]}/${m[2]}`, branch: m[3] ?? undefined };
}

/**
 * Le `globalScore` de l'évaluateur est sur 0–9 (cf. ml-rewards.service.ts) —
 * ramené sur 10 et borné, parce qu'une grille personnalisée mal remplie ne doit
 * pas pouvoir produire un score hors échelle.
 */
export function toScore10(globalScore: number): number {
  return Math.min(10, Math.max(0, (globalScore / 9) * 10));
}
