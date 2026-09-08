import { NextRequest, NextResponse } from 'next/server';
import {
  ChallengeRepository,
  ChallengeRepoRepository,
  ChallengeTeamRepository,
  TaskRepository,
  UserRepository,
} from '../../../../../../../../packages/database-service/repositories';
import {
  provisionContributorWorkspace,
  ProvisionerRegistry,
  mapRepoTypeToWorkspaceType,
} from '../../../../../../../../packages/provisioner/src/index.js';
import { verifyRequestToken } from '@/lib/auth';
import { GROUP_MAX_SIZE, pickGroupOwner } from '../../../../../../../../packages/services/challenge/group';
import { randomUUID } from 'crypto';
import { z } from 'zod';

const challengeRepo = new ChallengeRepository();
const challengeRepoRepo = new ChallengeRepoRepository();
const challengeTeamRepo = new ChallengeTeamRepository();
const taskRepo = new TaskRepository();
const userRepo = new UserRepository();

/**
 * Corps optionnel : sans lui, on rejoint en solo comme avant.
 * - `mode: 'group'` crée un groupe et renvoie son jeton d'invitation.
 * - `group: <uuid>` rejoint un groupe existant via le lien reçu.
 */
const joinBodySchema = z.object({
  mode: z.enum(['solo', 'group']).optional(),
  group: z.string().uuid().optional(),
});

/**
 * Rouvre la branche du groupe à tous ses membres.
 *
 * Le provisioning ne l'avait ouverte qu'au créateur : sans ce rappel, un
 * arrivant se ferait refuser son push sans comprendre pourquoi. Renvoie les
 * membres sans compte GitHub connecté — eux resteront bloqués, et l'UI doit
 * pouvoir le leur dire.
 */
async function reprotectGroupBranch(
  challengeId: string,
  groupId: string
): Promise<{ missingGithub: string[] }> {
  const members = await challengeTeamRepo.findByGroup(challengeId, groupId);
  const owner = members.find(m => m.user_id === pickGroupOwner(members));
  if (!owner?.workspace_ref) return { missingGithub: [] };

  const repos = await challengeRepoRepo.findByChallengeWithRepo(challengeId);
  const codeRepo = repos.find(r => r.repo_type === 'github' && r.repo_external_id);
  if (!codeRepo) return { missingGithub: [] };

  const users = await Promise.all(members.map(m => userRepo.findById(m.user_id)));
  const usernames = users.map(u => u?.github_username).filter((n): n is string => !!n);
  const missingGithub = users.filter(u => u && !u.github_username).map(u => u!.full_name);

  if (usernames.length > 0) {
    try {
      const provider = ProvisionerRegistry.getProvider(mapRepoTypeToWorkspaceType(codeRepo.repo_type));
      if (provider.protect) {
        await provider.protect(codeRepo.repo_external_id!, owner.workspace_ref, usernames);
      }
    } catch (error) {
      // Non bloquant : l'appartenance au groupe compte plus que l'ACL Git, qui
      // se rattrape au prochain join ou à la main.
      console.warn('[join] Group branch re-protection failed:', error);
    }
  }
  return { missingGithub };
}

// POST /api/challenges/[id]/join — rejoindre un challenge.
// Pour un challenge code : copie le board template et, en mode provided_repo,
// provisionne la branche personnelle du contributeur (protégée pour lui).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await verifyRequestToken(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized - Please login to join a challenge' }, { status: 401 });
    }
    const { id: challengeId } = await params;
    const userId = payload.userId;

    const challenge = await challengeRepo.findById(challengeId);
    if (!challenge) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    }
    if (challenge.status === 'completed' || challenge.status === 'archived') {
      return NextResponse.json({ error: 'This challenge is closed' }, { status: 403 });
    }

    const existing = await challengeTeamRepo.findByChallengeAndUser(challengeId, userId);
    if (existing) {
      // Bascule solo → groupe refusée : le contributeur a déjà un board copié
      // et une branche provisionnée, qu'il faudrait abandonner ou fusionner.
      return NextResponse.json({ error: 'You are already a member of this challenge' }, { status: 409 });
    }

    const parsedBody = joinBodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsedBody.success) {
      return NextResponse.json({ error: 'Invalid join options' }, { status: 400 });
    }
    const { mode: joinMode, group: invitedGroupId } = parsedBody.data;

    // Rejoindre un groupe existant : on ne copie pas de board et on ne
    // provisionne rien — le workspace est celui du porteur. Le lien EST
    // l'invitation, donc les seules barrières sont ici.
    if (invitedGroupId) {
      const groupMembers = await challengeTeamRepo.findByGroup(challengeId, invitedGroupId);
      if (groupMembers.length === 0) {
        return NextResponse.json({ error: 'This group no longer exists' }, { status: 404 });
      }
      if (groupMembers.length >= GROUP_MAX_SIZE) {
        return NextResponse.json(
          { error: `This group is full (${GROUP_MAX_SIZE} members maximum)` },
          { status: 409 }
        );
      }

      await challengeTeamRepo.create({
        challenge_id: challengeId,
        user_id: userId,
        group_id: invitedGroupId,
      });

      const { missingGithub } = await reprotectGroupBranch(challengeId, invitedGroupId);
      const participation = await challengeTeamRepo.findByChallengeAndUser(challengeId, userId);
      return NextResponse.json(
        { participation, tasksCreated: 0, group_id: invitedGroupId, missingGithub },
        { status: 201 }
      );
    }

    const isCode = challenge.type === 'code';
    const mode = challenge.workspace_mode ?? 'provided_repo';
    // Créer un groupe, c'est un join normal qui porte en plus un group_id : le
    // créateur reçoit bien son board et sa branche, que les autres rejoindront.
    const groupId = joinMode === 'group' ? randomUUID() : null;

    await challengeTeamRepo.create({
      challenge_id: challengeId,
      user_id: userId,
      ...(groupId ? { group_id: groupId } : {}),
      ...(isCode
        ? mode === 'own_repo'
          ? { workspace_provider: 'external' as const }
          : { workspace_provider: 'github' as const, workspace_status: 'pending' as const }
        : {}),
    });

    // Copie du board template (parents d'abord pour remapper les sous-tâches).
    let tasksCreated = 0;
    if (isCode) {
      const template = await taskRepo.findTemplateTasks(challengeId);
      const parents = template.filter(t => !t.parent_task_id);
      const children = template.filter(t => t.parent_task_id);
      const idMap = new Map<string, string>();
      for (const t of parents) {
        const created = await taskRepo.create({
          challenge_id: challengeId, user_id: userId,
          title: t.title, description: t.description, status: 'todo',
        });
        idMap.set(t.uuid, created.uuid);
        tasksCreated++;
      }
      for (const t of children) {
        await taskRepo.create({
          challenge_id: challengeId, user_id: userId,
          parent_task_id: idMap.get(t.parent_task_id!) ?? undefined,
          title: t.title, description: t.description, status: 'todo',
        });
        tasksCreated++;
      }
    }

    // Provision de la branche perso (mode provided_repo uniquement).
    if (isCode && mode === 'provided_repo') {
      const repos = await challengeRepoRepo.findByChallengeWithRepo(challengeId);
      const codeRepo = repos.find(r => r.repo_type === 'github' && r.repo_external_id);
      if (!codeRepo) {
        await challengeTeamRepo.updateWorkspace(challengeId, userId, { workspace_status: 'failed' });
      } else {
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
          if (result.status === 'ready' && result.ref && user?.github_username) {
            try {
              const provider = ProvisionerRegistry.getProvider(mapRepoTypeToWorkspaceType(codeRepo.repo_type));
              if (provider.protect) {
                await provider.protect(codeRepo.repo_external_id!, result.ref, [user.github_username]);
              }
            } catch (protectError) {
              console.warn('[join] Workspace protection failed:', protectError);
            }
          }
        } catch (provisionError) {
          console.error('[join] Provisioning failed:', provisionError);
          await challengeTeamRepo.updateWorkspace(challengeId, userId, { workspace_status: 'failed' });
        }
      }
    }

    const participation = await challengeTeamRepo.findByChallengeAndUser(challengeId, userId);
    // `group_id` n'est renvoyé qu'à son créateur : c'est le jeton d'invitation
    // qu'il partagera lui-même, il ne se lit nulle part ailleurs.
    return NextResponse.json(
      { participation, tasksCreated, ...(groupId ? { group_id: groupId } : {}) },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error joining challenge:', error);
    return NextResponse.json({ error: 'Failed to join challenge' }, { status: 500 });
  }
}
