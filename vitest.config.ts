import { defineConfig } from "vitest/config";

/**
 * Configuration racine — deux projets, parce que les tests du repo vivent dans
 * deux mondes qui ne se résolvent pas pareil.
 *
 * Sans ce fichier, `npm test` tournait à la racine sans aucune configuration,
 * donc sans l'alias `@`. Les fichiers de test de l'app Next qui importent
 * `@/lib/auth`, `@/lib/db` ou `@/lib/challengeBrief` — directement ou à travers
 * le module qu'ils testent — mouraient à la collecte. Vitest les comptait
 * `(0 test)` et signalait « 13 failed », alors qu'aucune assertion n'avait
 * échoué : ces 128 fichiers ne tournaient tout simplement que si on les
 * lançait depuis `apps/leaderboard-client`.
 *
 * `./apps/leaderboard-client` est référencé par son dossier : Vitest y charge
 * son `vitest.config.ts`, qui porte déjà l'alias, le `setupFiles` et le mock
 * de `server-only`. La config de l'app reste donc la seule source de vérité de
 * l'app, et lancer `npx vitest` depuis ce dossier continue de marcher à
 * l'identique.
 */
export default defineConfig({
  test: {
    projects: [
      // L'app Next, avec sa propre config (alias `@`, mock server-only).
      "./apps/leaderboard-client",
      // Le monorepo côté serveur : pas d'alias, Node nu. Le contenu installé
      // (connecteurs, flows) et les modules se testent de la même façon.
      {
        test: {
          name: "packages",
          globals: true,
          environment: "node",
          include: [
            "packages/**/*.test.{ts,tsx}",
            "content/**/*.test.{ts,tsx}",
            "modules/**/*.test.{ts,tsx}",
          ],
        },
      },
    ],
  },
});
