import { NextRequest, NextResponse } from 'next/server';
import { 
  TaskRepository, 
  TaskAssigneeRepository, 
  ChallengeRepository,
  ChallengeRepoRepository,
  TaskWorkspaceRepository 
} from '../../../../../../../../packages/database-service/repositories';
import { provisionTaskWorkspace } from '../../../../../../../../packages/provisioner/src/index.js';
import { jwtVerify } from 'jose';

const taskRepo = new TaskRepository();
const taskAssigneeRepo = new TaskAssigneeRepository();
const challengeRepo = new ChallengeRepository();
const challengeRepoRepo = new ChallengeRepoRepository();
const taskWorkspaceRepo = new TaskWorkspaceRepository();

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

    // Assigner l'utilisateur
    const assignment = await taskAssigneeRepo.assignUser(taskId, userId);

    // Provisionner les workspaces pour cette task
    const provisioningResults = [];
    
    // Récupérer le challenge parent et ses repos
    const challenge = await challengeRepo.findById(task.challenge_id);
    if (challenge) {
      const challengeRepos = await challengeRepoRepo.findByChallengeWithRepo(challenge.uuid);
      
      for (const cr of challengeRepos) {
        if (!cr.repo_external_id) continue;
        
        // Vérifier si un workspace existe déjà pour cette task/repo
        const existingWorkspace = await taskWorkspaceRepo.findByTaskAndRepo(taskId, cr.repo_id);
        if (existingWorkspace && existingWorkspace.workspace_status === 'ready') {
          provisioningResults.push({
            repo_id: cr.repo_id,
            status: 'already_exists',
            workspace: existingWorkspace,
          });
          continue;
        }

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
