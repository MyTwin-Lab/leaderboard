import { NextRequest, NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { UserRepository } from "../../../../../../../packages/database-service/repositories";

const userRepo = new UserRepository();

export async function GET() {
  const session = await getSessionUser();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ user: session });
}

export async function PATCH(request: NextRequest) {
  const session = await getSessionUser();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { full_name, github_username } = body;

  const updates: Record<string, string> = {};
  if (full_name !== undefined) updates.full_name = full_name;
  if (github_username !== undefined) updates.github_username = github_username;

  await userRepo.update(session.id, updates);

  return NextResponse.json({ success: true });
}
