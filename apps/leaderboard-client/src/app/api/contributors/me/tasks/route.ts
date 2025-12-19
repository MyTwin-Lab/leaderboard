import { NextRequest, NextResponse } from 'next/server';
import { TaskRepository, ChallengeRepository } from '../../../../../../../../packages/database-service/repositories';
import { jwtVerify } from 'jose';

const taskRepo = new TaskRepository();
const challengeRepo = new ChallengeRepository();

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

// GET /api/contributors/me/tasks - Récupérer les tâches assignées à l'utilisateur connecté
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Récupérer les tâches assignées à l'utilisateur
    const tasks = await taskRepo.findByUser(userId);

    // Enrichir avec les infos du challenge
    const tasksWithChallenge = await Promise.all(
      tasks.map(async (task) => {
        const challenge = await challengeRepo.findById(task.challenge_id);
        return {
          ...task,
          challenge_title: challenge?.title || 'Unknown Challenge',
        };
      })
    );

    return NextResponse.json(tasksWithChallenge);
  } catch (error) {
    console.error('Error fetching user tasks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tasks' },
      { status: 500 }
    );
  }
}
