import type { ChallengeCreateContext, RepoDefinition } from "../../../packages/registry/platform.js";

/**
 * Les dépôts d'un challenge ML, à sa création, un par étape et chacun avec son
 * rôle : l'étape modèle en a deux (Kaggle et GitHub), donc le type seul ne
 * distingue pas le code du modèle de celui de l'API. `api_packaging_enabled:
 * false` retire l'étape API.
 */
export function mlCreationRepos({ challenge, input }: ChallengeCreateContext): { repos: RepoDefinition[] } {
  const repos: RepoDefinition[] = [
    { title: `${challenge.title} — Dataset`, type: "kaggle_dataset", role: "dataset" },
    { title: `${challenge.title} — Model`, type: "kaggle_model", role: "model" },
    { title: `${challenge.title} — Model Code`, type: "github", role: "model_code" },
  ];
  if (input.api_packaging_enabled !== false) {
    repos.push({ title: `${challenge.title} — API`, type: "github", role: "api" });
  }
  return { repos };
}
