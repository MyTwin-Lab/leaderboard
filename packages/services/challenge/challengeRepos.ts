import type { ChallengeRepoRole } from "../../database-service/domain/entities.js";

/**
 * Les repos qu'un challenge se voit créer à sa naissance.
 *
 * Extrait tel quel de `api/challenges/route.ts` (POST), que la route importe
 * désormais : la promotion d'un sandbox crée un challenge sans passer par
 * cette route et doit produire exactement les mêmes repos, sinon un challenge
 * promu n'aurait pas les mêmes étapes qu'un challenge créé à la main.
 *
 * Pur, sans I/O : l'appelant persiste ensuite `repos` puis `challenge_repos`.
 * La parité avec l'ancien code inline est garantie par `challengeRepos.test.ts`.
 */
export interface RepoDefinition {
  title: string;
  type: string;
  /** Le rôle ML — absent pour un challenge code, qui n'a qu'un seul repo. */
  role?: ChallengeRepoRole;
  /** Slug `owner/repo`, quand le créateur en a fourni un. */
  external_repo_id?: string;
}

export interface BuildRepoDefinitionsInput {
  /** 'code' | 'ml' | 'validation'. */
  type: string;
  /** Titre du challenge — préfixe le nom de chaque repo. */
  title: string;
  /** Code uniquement. Défaut 'provided_repo', comme la colonne. */
  workspaceMode?: "provided_repo" | "own_repo" | null;
  /** Code + provided_repo uniquement : le slug déjà extrait de l'URL saisie. */
  githubSlug?: string;
  /** ML uniquement. `false` = pas d'étape API Packaging. */
  apiPackagingEnabled?: boolean;
}

/**
 * Auto-création des repos selon le type de challenge.
 *
 * Les repos ML portent un rôle explicite : l'étape modèle a deux repos
 * (Kaggle + GitHub) typés `kaggle_model` / `github`, donc le type seul ne
 * distingue plus le code du modèle de celui de l'API packaging.
 *
 * Un challenge de validation n'a **aucun** repo propre — il référence les
 * soumissions d'un challenge ML existant. Un challenge code en `own_repo` non
 * plus : chaque contributeur fournit le sien, il n'y a rien à provisionner.
 */
export function buildRepoDefinitions({
  type,
  title,
  workspaceMode,
  githubSlug,
  apiPackagingEnabled,
}: BuildRepoDefinitionsInput): RepoDefinition[] {
  if (type === "ml") {
    return [
      { title: `${title} — Dataset`,    type: "kaggle_dataset", role: "dataset"    },
      { title: `${title} — Model`,      type: "kaggle_model",   role: "model"      },
      { title: `${title} — Model Code`, type: "github",         role: "model_code" },
      ...(apiPackagingEnabled !== false
        ? [{ title: `${title} — API`, type: "github", role: "api" as const }]
        : []),
    ];
  }

  if (type === "validation") return [];

  if ((workspaceMode ?? "provided_repo") === "own_repo") return [];

  return [{ title: `${title} — Code`, type: "github", external_repo_id: githubSlug }];
}
