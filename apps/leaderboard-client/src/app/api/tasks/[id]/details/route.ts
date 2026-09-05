import { NextRequest, NextResponse } from 'next/server';
import { TaskRepository, ChallengeTeamRepository } from '../../../../../../../../packages/database-service/repositories';
import { resolveWorkspaceOwner } from '../../../../../../../../packages/services/challenge/group';
import { verifyRequestToken } from '@/lib/auth';

const taskRepo = new TaskRepository();
const challengeTeamRepo = new ChallengeTeamRepository();

// GET /api/tasks/[id]/details - Récupérer une tâche et ses sous-tâches
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await params;
    const task = await taskRepo.findById(taskId);
    if (!task) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    const subTasks = await taskRepo.findSubTasks(taskId);

    // Le board sur lequel travaille le visiteur. La page s'y compare pour
    // savoir si elle peut éditer : en groupe la tâche appartient au porteur,
    // pas au membre qui l'ouvre, et comparer à son propre id la verrouillerait
    // alors que l'API l'autorise. `null` pour un visiteur anonyme.
    const session = await verifyRequestToken(request);
    const boardOwnerId = session
      ? await resolveWorkspaceOwner(task.challenge_id, session.userId, { challengeTeamRepo })
      : null;

    return NextResponse.json({ task, subTasks, board_owner_id: boardOwnerId });
  } catch (error) {
    console.error('Error fetching task details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch task details' },
      { status: 500 }
    );
  }
}
