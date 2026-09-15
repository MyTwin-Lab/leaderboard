import type { ChallengeCreateContext, RepoDefinition } from "../../../packages/registry/platform.js";
import { codeConfigOf } from "./config.js";

/** `owner/repo`, depuis une URL GitHub ou un slug déjà nu. */
export function parseGithubSlug(input: unknown): string | undefined {
  if (typeof input !== "string" || !input) return undefined;
  const match = input.match(/github\.com\/([^/?#]+\/[^/?#]+)/);
  if (match) return match[1].replace(/\.git$/, "");
  if (/^[^/]+\/[^/]+$/.test(input)) return input;
  return undefined;
}

/**
 * Les dépôts d'un challenge code, à sa création : un seul, partagé, sur lequel
 * chaque participant reçoit sa branche. En `own_repo`, aucun : chacun apporte
 * le sien. `github_repo` est l'URL ou le slug saisi par le créateur.
 */
export function codeCreationRepos({ challenge, input }: ChallengeCreateContext): { repos: RepoDefinition[] } {
  if (codeConfigOf(challenge).workspace_mode === "own_repo") return { repos: [] };
  return {
    repos: [{ title: `${challenge.title} — Code`, type: "github", external_repo_id: parseGithubSlug(input.github_repo) }],
  };
}
