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

const challengeRepo = new ChallengeRepository();
const challengeRepoRepo = new ChallengeRepoRepository();
const challengeTeamRepo = new ChallengeTeamRepository();
const taskRepo = new TaskRepository();
const userRepo = new UserRepository();

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

    const existing = await challengeTeamRepo.findByChallengeAndUser(challengeId, userId);
    if (existing) {
      return NextResponse.json({ error: 'You are already a member of this challenge' }, { status: 409 });
    }

    const isCode = challenge.type === 'code';
    const mode = challenge.workspace_mode ?? 'provided_repo';

    await challengeTeamRepo.create({
      challenge_id: challengeId,
      user_id: userId,
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
    return NextResponse.json({ participation, tasksCreated }, { status: 201 });
  } catch (error) {
    console.error('Error joining challenge:', error);
    return NextResponse.json({ error: 'Failed to join challenge' }, { status: 500 });
  }
}
