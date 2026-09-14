import type { Task } from '../../../../../../packages/database-service/domain/entities';
import { canAccessChallengeInternals } from '@/lib/server/managerAuth';

export interface TaskSession {
  userId: string;
  role: string;
}

/**
 * Lecture d'une tâche. Une template (`user_id` nul) est lisible par toute
 * session ; une tâche personnelle seulement par son propriétaire ou par qui
 * accède aux internes du challenge (admin, manager, membre — un co-membre de
 * groupe l'est forcément).
 */
export async function canReadTask(
  task: Pick<Task, 'user_id' | 'challenge_id'>,
  session: TaskSession | null,
): Promise<boolean> {
  if (!task.user_id) return true;
  if (!session) return false;
  if (task.user_id === session.userId) return true;
  return canAccessChallengeInternals({ id: session.userId, role: session.role }, task.challenge_id);
}
