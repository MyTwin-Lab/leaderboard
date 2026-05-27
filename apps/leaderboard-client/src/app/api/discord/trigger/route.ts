import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { DiscordAccountRepository } from "../../../../../../../packages/database-service/repositories";
import { DiscordEvaluationRepository } from "../../../../../../../packages/database-service/repositories";
import { DiscordService } from "../../../../../../../packages/services/discord.service";
import { DiscordConnector } from "../../../../../../../packages/connectors/implementation/Discord.connector";
import { evaluateDiscordHelp } from "../../../../../../../packages/evaluator/discord/discord.evaluator";

const accountRepo = new DiscordAccountRepository();
const evaluationRepo = new DiscordEvaluationRepository();
const discordService = new DiscordService();

const triggerSchema = z.object({
  channel_id: z.string().min(1),
  trigger_message_id: z.string().min(1),
  emoji: z.string().min(1),
  helper: z.object({
    discord_id: z.string().min(1),
    username: z.string().min(1),
  }),
  beneficiary: z.object({
    discord_id: z.string().min(1),
    username: z.string().min(1),
  }),
});

export async function POST(request: NextRequest) {
  try {
    const secret = process.env.DISCORD_TRIGGER_SECRET;
    const authHeader = request.headers.get("authorization");
    if (!secret || authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const data = triggerSchema.parse(body);

    await Promise.all([
      accountRepo.upsert({ discord_id: data.helper.discord_id, username: data.helper.username }),
      accountRepo.upsert({ discord_id: data.beneficiary.discord_id, username: data.beneficiary.username }),
    ]);

    const botToken = process.env.DISCORD_BOT_TOKEN;
    if (!botToken) {
      console.error("[POST /api/discord/trigger] DISCORD_BOT_TOKEN not set");
      return NextResponse.json({ error: "Bot token not configured" }, { status: 500 });
    }

    const connector = new DiscordConnector(botToken);
    const messages = await connector.fetchMessagesBefore(
      data.channel_id,
      data.trigger_message_id,
      20
    );

    const evalResult = await evaluateDiscordHelp({
      messages,
      helper: data.helper,
      beneficiary: data.beneficiary,
    });

    const evaluation = await evaluationRepo.create({
      metadata: {
        channel_id: data.channel_id,
        trigger_message_id: data.trigger_message_id,
        emoji: data.emoji,
      },
      helper_discord_id: data.helper.discord_id,
      beneficiary_discord_id: data.beneficiary.discord_id,
      score: evalResult.skipped ? null : evalResult.evaluation.globalScore,
      status: evalResult.skipped ? "skipped" : "evaluated",
      notes: evalResult.skipped
        ? { skip_reason: evalResult.skip_reason }
        : { justification: evalResult.evaluation.justification, criteria: evalResult.evaluation.scores },
    });

    if (evalResult.skipped) {
      return NextResponse.json({ evaluation_id: evaluation.uuid, skipped: true }, { status: 200 });
    }

    const contribution = await discordService.awardPoints(
      evaluation.uuid,
      evalResult,
      messages
    );

    return NextResponse.json(
      { evaluation_id: evaluation.uuid, contribution_id: contribution?.uuid ?? null },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.issues }, { status: 400 });
    }
    console.error("[POST /api/discord/trigger]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
