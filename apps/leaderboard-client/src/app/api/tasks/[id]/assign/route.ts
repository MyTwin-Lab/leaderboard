import { NextRequest, NextResponse } from 'next/server';
import { 
  TaskRepository, 
  TaskAssigneeRepository, 
  ChallengeRepository,
  ChallengeRepoRepository,
  ChallengeTeamRepository,
  TaskWorkspaceRepository,
  UserRepository 
} from '../../../../../../../../packages/database-service/repositories';
import { provisionTaskWorkspace, ProvisionerRegistry } from '../../../../../../../../packages/provisioner/src/index.js';
import { mapRepoTypeToWorkspaceType } from '../../../../../../../../packages/provisioner/src/utils.js';
import { jwtVerify } from 'jose';

const taskRepo = new TaskRepository();
const taskAssigneeRepo = new TaskAssigneeRepository();
const challengeRepo = new ChallengeRepository();
const challengeRepoRepo = new ChallengeRepoRepository();
const taskWorkspaceRepo = new TaskWorkspaceRepository();
const challengeTeamRepo = new ChallengeTeamRepository();
const userRepo = new UserRepository();

// Extraire l'userId du token JWT
async function getUserIdFromRequest(request: NextRequest): Promise<string | null> {
  const token = request.cookies.get('access_token')?.value;
  if (!token) return null;

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    return payload.userId as string;
  } catch {
    return null;
  }
}

// POST /api/tasks/[id]/assign - S'assigner à une tâche
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id: taskId } = await params;

    // Vérifier que la tâche existe
    const task = await taskRepo.findById(taskId);
    if (!task) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    // Vérifier si l'utilisateur est déjà assigné
    const alreadyAssigned = await taskAssigneeRepo.isUserAssigned(taskId, userId);
    if (alreadyAssigned) {
      return NextResponse.json(
        { error: 'You are already assigned to this task' },
        { status: 400 }
      );
    }

    // Si la tâche est "solo", vérifier qu'il n'y a pas déjà quelqu'un d'assigné
    if (task.type === 'solo') {
      const assigneeCount = await taskAssigneeRepo.countAssignees(taskId);
      if (assigneeCount > 0) {
        return NextResponse.json(
          { error: 'This is a solo task and someone is already assigned' },
          { status: 400 }
        );
      }
    }

    // S'assurer que l'utilisateur fait partie du challenge_team
    const teamMembers = await challengeTeamRepo.findByChallenge(task.challenge_id);
    const isInTeam = teamMembers.some(m => m.user_id === userId);
    if (!isInTeam) {
      await challengeTeamRepo.create({ challenge_id: task.challenge_id, user_id: userId });
      console.log(`[task-assign] User ${userId} added to challenge_team for challenge ${task.challenge_id}`);
    }

    // Assigner l'utilisateur
    const assignment = await taskAssigneeRepo.assignUser(taskId, userId);

    // Provisionner le workspace pour cette task (un seul repo)
    const provisioningResults = [];
    
    const challenge = await challengeRepo.findById(task.challenge_id);
    if (challenge && task.repo_id) {
      // Récupérer le challenge_repo correspondant au repo de la tâche
      const challengeRepos = await challengeRepoRepo.findByChallengeWithRepo(challenge.uuid);
      const cr = challengeRepos.find(r => r.repo_id === task.repo_id);

      if (cr) {
        const isKaggle = cr.repo_type === 'kaggle_model' || cr.repo_type === 'kaggle_dataset';

        if (isKaggle) {
          // Kaggle workspaces are user-submitted — no automatic provisioning
          const existingWorkspace = await taskWorkspaceRepo.findByTaskAndRepo(taskId, cr.repo_id);
          if (!existingWorkspace) {
            await taskWorkspaceRepo.create({
              task_id: taskId,
              repo_id: cr.repo_id,
              workspace_provider: 'kaggle',
              workspace_status: 'pending',
              workspace_meta: { type: cr.repo_type },
            });
          }
          provisioningResults.push({ repo_id: cr.repo_id, status: 'pending_user_submission' });
          console.log(`[task-assign] Kaggle repo ${cr.repo_id} — workspace pending user URL submission`);

        } else if (cr.repo_external_id) {
          // Vérifier si un workspace existe déjà pour cette task/repo
          const existingWorkspace = await taskWorkspaceRepo.findByTaskAndRepo(taskId, cr.repo_id);
          if (existingWorkspace && existingWorkspace.workspace_status === 'ready') {
            provisioningResults.push({
              repo_id: cr.repo_id,
              status: 'already_exists',
              workspace: existingWorkspace,
            });
          } else {
            try {
              console.log(`[task-assign] Provisioning workspace for task "${task.title}" on repo ${cr.repo_external_id}`);

              const result = await provisionTaskWorkspace({
                challengeIndex: challenge.index ?? 0,
                taskTitle: task.title,
                repoExternalId: cr.repo_external_id,
                repoType: cr.repo_type,
                challengeBranchRef: cr.workspace_ref,
              });

              // Créer ou mettre à jour le task_workspace
              if (existingWorkspace) {
                await taskWorkspaceRepo.updateWorkspace(taskId, cr.repo_id, {
                  workspace_provider: result.provider,
                  workspace_ref: result.ref,
                  workspace_url: result.url,
                  workspace_status: result.status,
                  workspace_meta: result.meta,
                });
              } else {
                await taskWorkspaceRepo.create({
                  task_id: taskId,
                  repo_id: cr.repo_id,
                  workspace_provider: result.provider,
                  workspace_ref: result.ref,
                  workspace_url: result.url,
                  workspace_status: result.status,
                  workspace_meta: result.meta,
                });
              }

              provisioningResults.push({
                repo_id: cr.repo_id,
                status: result.status,
                result,
              });

              // Protéger le workspace (restreindre l'accès à l'assignee)
              if (result.status === 'ready' && result.ref) {
                try {
                  const workspaceType = mapRepoTypeToWorkspaceType(cr.repo_type);
                  const provider = ProvisionerRegistry.getProvider(workspaceType);
                  if (provider.protect) {
                    const user = await userRepo.findById(userId);
                    if (user?.github_username) {
                      await provider.protect(cr.repo_external_id, result.ref, [user.github_username]);
                    }
                  }
                } catch (protectError) {
                  console.warn(`[task-assign] Workspace protection failed for repo ${cr.repo_id}:`, protectError);
                }
              }

              if (result.error) {
                console.warn(`[task-assign] Provisioning warning for repo ${cr.repo_id}: ${result.error}`);
              }
            } catch (provisionError) {
              console.error(`[task-assign] Provisioning failed for repo ${cr.repo_id}:`, provisionError);

              // Créer un workspace en état failed
              if (!existingWorkspace) {
                await taskWorkspaceRepo.create({
                  task_id: taskId,
                  repo_id: cr.repo_id,
                  workspace_status: 'failed',
                  workspace_meta: {
                    error: provisionError instanceof Error ? provisionError.message : 'Unknown error',
                  },
                });
              } else {
                await taskWorkspaceRepo.updateWorkspace(taskId, cr.repo_id, {
                  workspace_status: 'failed',
                  workspace_meta: {
                    error: provisionError instanceof Error ? provisionError.message : 'Unknown error',
                  },
                });
              }

              provisioningResults.push({
                repo_id: cr.repo_id,
                status: 'failed',
                error: provisionError instanceof Error ? provisionError.message : 'Unknown error',
              });
            }
          }
        } else {
          console.warn(`[task-assign] Repo ${cr.repo_id} (${cr.repo_type}) has no external_repo_id, skipping provisioning`);
        }
      } else {
        console.warn(`[task-assign] No matching challenge repo found for task repo_id ${task.repo_id}`);
      }
    } else if (!task.repo_id) {
      console.log(`[task-assign] Task "${task.title}" has no repo_id, skipping provisioning`);
    }

    return NextResponse.json({
      assignment,
      provisioning: provisioningResults,
    }, { status: 201 });
  } catch (error) {
    console.error('Error assigning to task:', error);
    return NextResponse.json(
      { error: 'Failed to assign to task' },
      { status: 500 }
    );
  }
}

// DELETE /api/tasks/[id]/assign - Se désassigner d'une tâche
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id: taskId } = await params;

    // Vérifier que la tâche existe
    const task = await taskRepo.findById(taskId);
    if (!task) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    // Vérifier si l'utilisateur est assigné
    const isAssigned = await taskAssigneeRepo.isUserAssigned(taskId, userId);
    if (!isAssigned) {
      return NextResponse.json(
        { error: 'You are not assigned to this task' },
        { status: 400 }
      );
    }

    // Désassigner l'utilisateur
    await taskAssigneeRepo.unassignUser(taskId, userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error unassigning from task:', error);
    return NextResponse.json(
      { error: 'Failed to unassign from task' },
      { status: 500 }
    );
  }
}
