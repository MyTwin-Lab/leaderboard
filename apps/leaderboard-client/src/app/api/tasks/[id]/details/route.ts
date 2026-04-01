import { NextRequest, NextResponse } from 'next/server';
import {
  TaskRepository,
  TaskAssigneeRepository,
  TaskWorkspaceRepository,
  ChallengeRepository,
  ContributionRepository,
  RepoRepository,
} from '../../../../../../../../packages/database-service/repositories';
import { jwtVerify } from 'jose';

const taskRepo = new TaskRepository();
const taskAssigneeRepo = new TaskAssigneeRepository();
const taskWorkspaceRepo = new TaskWorkspaceRepository();
const challengeRepo = new ChallengeRepository();
const contributionRepo = new ContributionRepository();
const repoRepo = new RepoRepository();

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

// GET /api/tasks/[id]/details - Récupérer les détails complets d'une tâche
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserIdFromRequest(request);

    const { id: taskId } = await params;
    const task = await taskRepo.findById(taskId);
    if (!task) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    // Fetch all related data in parallel
    const [challenge, assignees, taskWorkspaces, subTasks] = await Promise.all([
      challengeRepo.findById(task.challenge_id),
      taskRepo.findAssignees(taskId),
      taskWorkspaceRepo.findByTaskWithRepo(taskId),
      taskRepo.findSubTasks(taskId),
    ]);

    // Enrich workspaces with repo info
    const workspaces = await Promise.all(
      taskWorkspaces.map(async (tw) => {
        const repo = await repoRepo.findById(tw.repo_id);
        return {
          repo_id: tw.repo_id,
          repo_title: repo?.title ?? 'Unknown',
          repo_type: tw.repo_type,
          repo_external_id: tw.repo_external_id,
          workspace_provider: tw.workspace_provider,
          workspace_ref: tw.workspace_ref,
          workspace_url: tw.workspace_url,
          workspace_status: tw.workspace_status,
          workspace_meta: tw.workspace_meta,
        };
      })
    );

    // Fetch contribution for the current user (if authenticated)
    let contribution = null;
    if (userId) {
      contribution = await contributionRepo.findByTaskAndUser(taskId, userId);
    }

    return NextResponse.json({
      task,
      challenge: challenge
        ? {
            uuid: challenge.uuid,
            title: challenge.title,
            status: challenge.status,
            completion: challenge.completion,
            contribution_points_reward: challenge.contribution_points_reward,
          }
        : null,
      assignees: assignees.map((a) => ({
        uuid: a.uuid,
        full_name: a.full_name,
        github_username: a.github_username,
      })),
      workspaces,
      subTasks,
      contribution,
    });
  } catch (error) {
    console.error('Error fetching task details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch task details' },
      { status: 500 }
    );
  }
}
