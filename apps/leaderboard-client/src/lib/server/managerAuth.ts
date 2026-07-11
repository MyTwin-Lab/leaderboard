import "server-only";
import { repositories } from "@/lib/db";

export async function isManagerOfChallenge(userId: string, challengeId: string): Promise<boolean> {
  const challenge = await repositories.challenge.findById(challengeId);
  if (!challenge) return false;
  const project = await repositories.project.findById(challenge.project_id);
  return project?.manager_id === userId;
}
