import { z } from "zod";
import type { ActionContext } from "../../../../packages/registry/platform.js";
import { ChallengeTeamRepository } from "../../../../packages/database-service/repositories/index.js";
import { resolveWorkspaceOwner } from "../../../../packages/capabilities/groups.js";
import { codeConfigOf } from "../config.js";

const challengeTeamRepo = new ChallengeTeamRepository();

const bodySchema = z.object({
  repo_url: z.string().trim().regex(
    /^https:\/\/github\.com\/[^/?#]+\/[^/?#]+/,
    "repo_url must be a public GitHub repository URL"
  ),
});

/**
 * `PATCH workspace` — mode `own_repo` : le participant déclare (ou change)
 * l'URL du dépôt GitHub public qui porte son livrable. Réservé aux membres
 * (accès déclaré dans `index.ts`).
 */
export async function setOwnRepo({ request, challenge, user }: ActionContext) {
  if (codeConfigOf(challenge).workspace_mode !== "own_repo") {
    return Response.json({ error: "This challenge does not accept contributor repos" }, { status: 400 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    raw = null;
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid repo_url" }, { status: 400 });
  }

  // Le repo se déclare sur la participation du porteur : un groupe livre
  // depuis un seul dépôt. En solo le porteur est l'appelant lui-même.
  const ownerId = await resolveWorkspaceOwner(challenge.uuid, user.id, { challengeTeamRepo });
  const participation = await challengeTeamRepo.updateWorkspace(challenge.uuid, ownerId, {
    workspace_provider: "external",
    workspace_url: parsed.data.repo_url,
    workspace_status: "ready",
  });
  return { participation };
}
