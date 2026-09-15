import type { ChallengeGroupJoinContext, ChallengeJoinContext } from "../../../packages/registry/platform.js";
import {
  ChallengeRepoRepository,
  ChallengeTeamRepository,
  UserRepository,
} from "../../../packages/database-service/repositories/index.js";
import {
  mapRepoTypeToWorkspaceType,
  provisionContributorWorkspace,
  ProvisionerRegistry,
} from "../../../packages/provisioner/src/index.js";
import { pickGroupOwner } from "../../../packages/capabilities/groups.js";
import { codeConfigOf } from "./config.js";

/**
 * Hooks de join du flow code : le workspace de chaque participant. Chargés à
 * la demande par `index.ts`, pour que déclarer le flow ne charge pas le
 * provisioner.
 */

const challengeRepoRepo = new ChallengeRepoRepository();
const challengeTeamRepo = new ChallengeTeamRepository();
const userRepo = new UserRepository();

async function sharedCodeRepo(challengeId: string) {
  const repos = await challengeRepoRepo.findByChallengeWithRepo(challengeId);
  return repos.find((r) => r.repo_type === "github" && r.repo_external_id);
}

/**
 * Au join d'un participant solo ou d'un créateur de groupe. En `own_repo`, il
 * déclarera son propre dépôt. Sinon sa branche perso est créée sur le dépôt du
 * challenge et protégée pour lui ; un échec de provisioning marque le
 * workspace `failed` sans faire échouer le join.
 */
export async function provisionWorkspace({ challenge, userId }: ChallengeJoinContext): Promise<void> {
  const challengeId = challenge.uuid;
  if (codeConfigOf(challenge).workspace_mode === "own_repo") {
    await challengeTeamRepo.updateWorkspace(challengeId, userId, { workspace_provider: "external" });
    return;
  }

  await challengeTeamRepo.updateWorkspace(challengeId, userId, { workspace_provider: "github", workspace_status: "pending" });
  const codeRepo = await sharedCodeRepo(challengeId);
  if (!codeRepo) {
    await challengeTeamRepo.updateWorkspace(challengeId, userId, { workspace_status: "failed" });
    return;
  }

  const user = await userRepo.findById(userId);
  try {
    const result = await provisionContributorWorkspace({
      challengeIndex: challenge.index ?? 0,
      username: user?.github_username || user?.full_name || userId,
      repoExternalId: codeRepo.repo_external_id!,
      repoType: codeRepo.repo_type,
      challengeBranchRef: codeRepo.workspace_ref,
    });
    await challengeTeamRepo.updateWorkspace(challengeId, userId, {
      workspace_ref: result.ref,
      workspace_url: result.url,
      workspace_status: result.status,
    });
    if (result.status === "ready" && result.ref && user?.github_username) {
      try {
        const provider = ProvisionerRegistry.getProvider(mapRepoTypeToWorkspaceType(codeRepo.repo_type));
        if (provider.protect) {
          await provider.protect(codeRepo.repo_external_id!, result.ref, [user.github_username]);
        }
      } catch (protectError) {
        console.warn("[code] Workspace protection failed:", protectError);
      }
    }
  } catch (provisionError) {
    console.error("[code] Provisioning failed:", provisionError);
    await challengeTeamRepo.updateWorkspace(challengeId, userId, { workspace_status: "failed" });
  }
}

/**
 * À l'arrivée d'un membre dans un groupe : la branche du porteur se rouvre à
 * tous les membres. Le provisioning ne l'avait ouverte qu'au créateur ; sans
 * ce rappel, un arrivant se ferait refuser son push sans comprendre pourquoi.
 * Rapporte les membres sans compte GitHub, qui resteront bloqués.
 */
export async function reprotectGroupBranch({ challenge, groupId }: ChallengeGroupJoinContext): Promise<{ missingGithub: string[] }> {
  const challengeId = challenge.uuid;
  const members = await challengeTeamRepo.findByGroup(challengeId, groupId);
  const owner = members.find((m) => m.user_id === pickGroupOwner(members));
  if (!owner?.workspace_ref) return { missingGithub: [] };

  const codeRepo = await sharedCodeRepo(challengeId);
  if (!codeRepo) return { missingGithub: [] };

  const users = await Promise.all(members.map((m) => userRepo.findById(m.user_id)));
  const usernames = users.map((u) => u?.github_username).filter((n): n is string => !!n);
  const missingGithub = users.filter((u) => u && !u.github_username).map((u) => u!.full_name);

  if (usernames.length > 0) {
    try {
      const provider = ProvisionerRegistry.getProvider(mapRepoTypeToWorkspaceType(codeRepo.repo_type));
      if (provider.protect) {
        await provider.protect(codeRepo.repo_external_id!, owner.workspace_ref, usernames);
      }
    } catch (error) {
      // Non bloquant : l'appartenance au groupe compte plus que l'ACL Git, qui
      // se rattrape au prochain join ou à la main.
      console.warn("[code] Group branch re-protection failed:", error);
    }
  }
  return { missingGithub };
}
