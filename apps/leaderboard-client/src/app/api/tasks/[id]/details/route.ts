import { NextRequest, NextResponse } from 'next/server';
import { TaskRepository, ChallengeRepository, ChallengeTeamRepository } from '../../../../../../../../packages/database-service/repositories';
import { resolveWorkspaceOwner } from '../../../../../../../../packages/capabilities/groups';
import { verifyRequestToken } from '@/lib/auth';
import { canReadTask } from '../../taskAccess';

const taskRepo = new TaskRepository();
const challengeRepo = new ChallengeRepository();
const challengeTeamRepo = new ChallengeTeamRepository();

// GET /api/tasks/[id]/details - Récupérer une tâche et ses sous-tâches
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await params;
    const task = await taskRepo.findById(taskId);
    const session = await verifyRequestToken(request);
    // Tâche personnelle illisible : même 404 qu'une tâche absente. Les
    // sous-tâches partagent le scope du parent, ce contrôle les couvre.
    if (!task || !(await canReadTask(task, session))) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    const [subTasks, challenge] = await Promise.all([
      taskRepo.findSubTasks(taskId),
      // La page renvoie vers celle du challenge, qui vit à son slug.
      challengeRepo.findById(task.challenge_id),
    ]);

    // Le board sur lequel travaille le visiteur. La page s'y compare pour
    // savoir si elle peut éditer : en groupe la tâche appartient au porteur,
    // pas au membre qui l'ouvre, et comparer à son propre id la verrouillerait
    // alors que l'API l'autorise. `null` pour un visiteur anonyme.
    const boardOwnerId = session
      ? await resolveWorkspaceOwner(task.challenge_id, session.userId, { challengeTeamRepo })
      : null;

    return NextResponse.json({
      task,
      subTasks,
      board_owner_id: boardOwnerId,
      challenge_slug: challenge?.slug ?? null,
    });
  } catch (error) {
    console.error('Error fetching task details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch task details' },
      { status: 500 }
    );
  }
}
