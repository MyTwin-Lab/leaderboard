import { createHash } from "crypto";
import { DiscordEvaluationRepository } from "../database-service/repositories/discordEvaluation.repo.js";
import { DiscordAccountRepository } from "../database-service/repositories/discordAccount.repo.js";
import { db, contributions } from "../database-service/db/drizzle.js";
import type { DiscordContributionOutput } from "../evaluator/discord/discord.evaluator.js";
import type { DiscordMessageItem } from "../connectors/implementation/Discord.connector.js";

// Hors challenge : 1 CP par tranche de 10 points (score 0–100 → 1–10 CP)
function scoreToCP(globalScore: number): number {
  return Math.max(1, Math.round(globalScore / 10));
}

function computeContextHash(channelId: string, messages: DiscordMessageItem[]): string {
  const ids = messages.map((m) => m.id).sort().join(",");
  return createHash("sha256").update(`${channelId}:${ids}`).digest("hex").slice(0, 64);
}

const evaluationRepo = new DiscordEvaluationRepository();
const accountRepo = new DiscordAccountRepository();

export class DiscordService {
  async awardPoints(
    evaluation_id: string,
    result: DiscordContributionOutput,
    messages: DiscordMessageItem[]
  ) {
    const evalRecord = await evaluationRepo.findWithParticipants(evaluation_id);
    if (!evalRecord) throw new Error(`Evaluation ${evaluation_id} not found`);

    const { helper, evaluation } = evalRecord;

    if (!helper) {
      console.warn(`[DiscordService] No helper for evaluation ${evaluation_id}, skipping`);
      return null;
    }
    if (!helper.user_id) {
      console.warn(`[DiscordService] Helper ${helper.discord_id} has no linked user, skipping`);
      return null;
    }

    const reward = scoreToCP(result.evaluation.globalScore);
    const context_hash = computeContextHash(evaluation.metadata.channel_id, messages);

    const [contribution] = await db.insert(contributions).values({
      title: result.title,
      type: "discord_help",
      description: result.description,
      tags: result.tags ?? [],
      reward,
      user_id: helper.user_id,
      evaluation: {
        ...result.evaluation,
        evaluation_id,
        messages,
      },
    }).returning();

    await evaluationRepo.saveResult(evaluation_id, {
      score: result.evaluation.globalScore,
      notes: result.evaluation,
      contribution_id: contribution.uuid,
      context_hash,
    });

    console.log(`[DiscordService] ${reward} CP → ${helper.username} | score: ${result.evaluation.globalScore}`);
    return contribution;
  }
}