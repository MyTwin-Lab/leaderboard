import { DiscordConversationRepository } from "../database-service/repositories/discordConversation.repo.js";
import { DiscordEvaluationRepository } from "../database-service/repositories/discordEvaluation.repo.js";
import { DiscordAccountRepository } from "../database-service/repositories/discordAccount.repo.js";
import { db, contributions } from "../database-service/db/drizzle.js";

const conversationRepo = new DiscordConversationRepository();
const evaluationRepo = new DiscordEvaluationRepository();
const accountRepo = new DiscordAccountRepository();

// Points attribués = score LLM (0-100) traduit en CP
// Formule : 1 CP par tranche de 10 points, max 10 CP
function computePoints(score: number): number {
  return Math.max(1, Math.round(score / 10));
}

export class DiscordService {
  /**
   * Appelé dès qu'une conversation est clôturée (trigger GRATITUDE).
   * Crée une entrée discord_evaluations en statut "pending"
   * pour signaler au LLM qu'une évaluation est à faire.
   */
  async initEvaluation(conversation_id: string) {
    const existing = await evaluationRepo.findByConversation(conversation_id);
    if (existing) return existing;
    return evaluationRepo.create({ conversation_id });
  }

  /**
   * Appelé après réception du résultat LLM (POST /api/discord/evaluation-result).
   * Attribue des points au helper sous forme de contribution Discord.
   */
  async awardPoints(conversation_id: string, score: number) {
    const result = await conversationRepo.findWithMessages(conversation_id);
    if (!result) throw new Error(`Conversation ${conversation_id} not found`);

    const { conversation, helper } = result;

    if (!helper) {
      console.warn(`[DiscordService] No helper found for conversation ${conversation_id}, skipping award`);
      return null;
    }

    if (!helper.user_id) {
      console.warn(`[DiscordService] Helper ${helper.discord_id} has no linked user, skipping award`);
      return null;
    }

    const points = computePoints(score);

    const [contribution] = await db.insert(contributions).values({
      title: `Aide Discord — conversation ${conversation_id}`,
      type: "discord_help",
      description: `Score LLM : ${score}/100 → ${points} CP attribués`,
      reward: points,
      user_id: helper.user_id,
      // challenge_id laissé null : contribution hors challenge
    }).returning();

    console.log(`[DiscordService] ${points} CP attribués à l'utilisateur ${helper.user_id} (helper: ${helper.username})`);

    return contribution;
  }
}
