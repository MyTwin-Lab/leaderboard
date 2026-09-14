import "server-only";
import { repositories } from "@/lib/db";

export async function isManagerOfChallenge(userId: string, challengeId: string): Promise<boolean> {
  const challenge = await repositories.challenge.findById(challengeId);
  if (!challenge) return false;
  const project = await repositories.project.findById(challenge.project_id);
  return project?.manager_id === userId;
}

/**
 * Accès aux données internes d'un challenge (meetings, boards personnels) :
 * admin, manager du projet ou membre de l'équipe. Une session seule ne suffit
 * pas — toute inscription Google crée un compte `contributor`.
 */
export async function canAccessChallengeInternals(
  user: { id: string; role: string },
  challengeId: string,
): Promise<boolean> {
  if (user.role === "admin") return true;
  if (await isManagerOfChallenge(user.id, challengeId)) return true;
  return !!(await repositories.challengeTeam.findByChallengeAndUser(challengeId, user.id));
}
