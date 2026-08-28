import { NextRequest, NextResponse } from 'next/server';
import {
  TaskRepository,
  ChallengeRepository,
  ContributionRepository,
} from '../../../../../../../../packages/database-service/repositories';
import { jwtVerify } from 'jose';

const taskRepo = new TaskRepository();
const challengeRepo = new ChallengeRepository();
const contributionRepo = new ContributionRepository();

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
//
// NOTE: interim version — task_assignees/task_workspaces were removed with
// the personal-boards refactor (tasks are now owned via tasks.user_id, and
// workspace state lives on challenge_teams). This route is rewritten to the
// new model in a later task; for now it just drops the assignees/workspaces
// enrichment so the app keeps compiling.
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
    const [challenge, subTasks] = await Promise.all([
      challengeRepo.findById(task.challenge_id),
      taskRepo.findSubTasks(taskId),
    ]);

    // Fetch contribution for the current user (if authenticated)
    let contribution = null;
    if (userId) {
      contribution = await contributionRepo.findByTaskAndUser(taskId, userId);
    }

    return NextResponse.json({
      currentUserId: userId,
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
