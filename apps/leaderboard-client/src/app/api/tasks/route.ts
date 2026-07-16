import { NextRequest, NextResponse } from 'next/server';
import { TaskRepository, ChallengeRepository } from '../../../../../../packages/database-service/repositories';
import { z } from 'zod';

const taskRepo = new TaskRepository();
const challengeRepo = new ChallengeRepository();

const createTaskSchema = z.object({
  challenge_id: z.string().uuid(),
  repo_id: z.string().uuid().optional(),
  parent_task_id: z.string().uuid().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(['solo', 'concurrent']),
});

// GET /api/tasks?challenge_id=xxx&include=assignees - Liste les tâches d'un challenge
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const challengeId = searchParams.get('challenge_id');
    const include = searchParams.get('include');

    if (!challengeId) {
      return NextResponse.json(
        { error: 'challenge_id is required' },
        { status: 400 }
      );
    }

    if (include === 'assignees') {
      const tasksWithAssignees = await taskRepo.findByChallengeWithAssignees(challengeId);
      return NextResponse.json(tasksWithAssignees);
    }

    const tasks = await taskRepo.findByChallenge(challengeId);
    return NextResponse.json(tasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tasks' },
      { status: 500 }
    );
  }
}

// POST /api/tasks - Créer une nouvelle tâche
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = createTaskSchema.parse(body);

    // ML challenges use the dataset/model/API submission flow, not tasks.
    // Their reward pipeline assumes no task ever points at a Kaggle repo.
    const challenge = await challengeRepo.findById(validated.challenge_id);
    if (!challenge) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    }
    if (challenge.type === 'ml') {
      return NextResponse.json(
        { error: 'ML challenges cannot have tasks' },
        { status: 400 }
      );
    }

    const task = await taskRepo.create({
      ...validated,
      status: 'todo',
    });
    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error creating task:', error);
    return NextResponse.json(
      { error: 'Failed to create task' },
      { status: 500 }
    );
  }
}
