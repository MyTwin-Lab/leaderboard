import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyRequestToken } from "@/lib/auth";
import { DiscordAccountRepository } from "../../../../../../../packages/database-service/repositories";

const accountRepo = new DiscordAccountRepository();

const linkSchema = z.object({
  discord_id: z.string().min(1).max(32),
});

export async function POST(request: NextRequest) {
  const payload = await verifyRequestToken(request);
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { discord_id } = linkSchema.parse(body);

    const account = await accountRepo.linkUser(discord_id, payload.userId);
    return NextResponse.json({ discord_id: account.discord_id }, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.issues }, { status: 400 });
    }
    console.error("[POST /api/discord/link]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}