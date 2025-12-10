import { NextRequest, NextResponse } from 'next/server';
import { TaskRepository } from '../../../../../../packages/database-service/repositories';
import { z } from 'zod';

const taskRepo = new TaskRepository();

const createTaskSchema = z.object({
  challenge_id: z.string().uuid(),
  parent_task_id: z.string().uuid().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(['solo', 'concurrent']),
});

// GET /api/tasks?challenge_id=xxx - Liste les tâches d'un challenge
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const challengeId = searchParams.get('challenge_id');

    if (!challengeId) {
      return NextResponse.json(
        { error: 'challenge_id is required' },
        { status: 400 }
      );
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

    const task = await taskRepo.create(validated);
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
