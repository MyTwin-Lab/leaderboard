import { NextRequest, NextResponse } from 'next/server';
import { TaskRepository, ChallengeRepository, ChallengeTeamRepository } from '../../../../../../packages/database-service/repositories';
import { repositories } from '@/lib/db';
import { resolveWorkspaceOwner } from '../../../../../../packages/services/challenge/group';
import { jwtVerify } from 'jose';
import { z } from 'zod';

const taskRepo = new TaskRepository();
const challengeRepo = new ChallengeRepository();
const challengeTeamRepo = new ChallengeTeamRepository();

async function getSession(request: NextRequest) {
  const token = request.cookies.get('access_token')?.value;
  if (!token) return null;
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    return { userId: payload.userId as string, role: payload.role as string };
  } catch {
    return null;
  }
}

async function isChallengeManager(session: { userId: string; role: string }, challengeProjectId: string) {
  if (session.role === 'admin') return true;
  const project = await repositories.project.findById(challengeProjectId);
  return !!project && project.manager_id === session.userId;
}

const createTaskSchema = z.object({
  challenge_id: z.string().uuid(),
  parent_task_id: z.string().uuid().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  /** true = tâche template (admin/manager) ; sinon tâche du board perso. */
  template: z.boolean().optional(),
});

// GET /api/tasks?challenge_id=xxx&scope=mine|template|all
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const challengeId = searchParams.get('challenge_id');
    const scope = searchParams.get('scope') ?? 'all';
    if (!challengeId) {
      return NextResponse.json({ error: 'challenge_id is required' }, { status: 400 });
    }

    if (scope === 'mine') {
      const session = await getSession(request);
      if (!session) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      // "mine" désigne le board sur lequel je travaille, pas les tâches dont
      // je suis le propriétaire en base : en groupe c'est celui du porteur.
      const ownerId = await resolveWorkspaceOwner(challengeId, session.userId, { challengeTeamRepo });
      return NextResponse.json(await taskRepo.findPersonalTasks(challengeId, ownerId));
    }
    if (scope === 'template') {
      return NextResponse.json(await taskRepo.findTemplateTasks(challengeId));
    }
    return NextResponse.json(await taskRepo.findByChallenge(challengeId));
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
  }
}

// POST /api/tasks — créer une tâche perso (membre) ou template (admin/manager)
export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const body = await request.json();
    const validated = createTaskSchema.parse(body);

    const challenge = await challengeRepo.findById(validated.challenge_id);
    if (!challenge) return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    if (challenge.type !== 'code') {
      return NextResponse.json({ error: 'Only code challenges have tasks' }, { status: 400 });
    }

    // Board de travail de l'appelant : le sien en solo, celui du porteur en
    // groupe. Résolu avant le contrôle du parent, qui s'y compare.
    const boardOwnerId = await resolveWorkspaceOwner(validated.challenge_id, session.userId, { challengeTeamRepo });

    if (validated.parent_task_id) {
      const parent = await taskRepo.findById(validated.parent_task_id);
      if (!parent || parent.challenge_id !== validated.challenge_id) {
        return NextResponse.json({ error: 'Parent task not found on this challenge' }, { status: 400 });
      }
      // Templates and personal boards never mix — a sub-task must share its
      // parent's scope: a template body needs a template parent, a personal
      // body needs a parent owned by the board the caller works on.
      const expectedParentOwner = validated.template ? null : boardOwnerId;
      if (parent.user_id !== expectedParentOwner) {
        return NextResponse.json({ error: 'Parent task is not in the same scope' }, { status: 400 });
      }
    }

    if (validated.template) {
      if (!(await isChallengeManager(session, challenge.project_id))) {
        return NextResponse.json({ error: 'Only the challenge manager can edit the template' }, { status: 403 });
      }
      const task = await taskRepo.create({
        challenge_id: validated.challenge_id,
        user_id: null,
        parent_task_id: validated.parent_task_id,
        title: validated.title,
        description: validated.description,
        status: 'todo',
      });
      return NextResponse.json(task, { status: 201 });
    }

    const membership = await challengeTeamRepo.findByChallengeAndUser(validated.challenge_id, session.userId);
    if (!membership) {
      return NextResponse.json({ error: 'Join the challenge first' }, { status: 403 });
    }
    const task = await taskRepo.create({
      challenge_id: validated.challenge_id,
      user_id: boardOwnerId,
      parent_task_id: validated.parent_task_id,
      title: validated.title,
      description: validated.description,
      status: 'todo',
    });
    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 400 });
    }
    console.error('Error creating task:', error);
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
  }
}
