import { NextRequest, NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { repositories } from "@/lib/db";
import { UserRepository } from "../../../../../../../packages/database-service/repositories";

const userRepo = new UserRepository();

export async function GET() {
  const session = await getSessionUser();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const managedProjects = await repositories.project.findByManagerId(session.id);
  return NextResponse.json({ user: session, managedProjectIds: managedProjects.map(p => p.uuid) });
}

export async function PATCH(request: NextRequest) {
  const session = await getSessionUser();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { full_name, github_username, avatar_url } = body;

  type UserPatch = Parameters<typeof userRepo.update>[1];
  const updates: UserPatch = {};

  if (full_name !== undefined) {
    if (typeof full_name !== "string" || full_name.trim().length < 1 || full_name.trim().length > 255) {
      return NextResponse.json({ error: "full_name must be 1–255 characters" }, { status: 400 });
    }
    updates.full_name = full_name.trim();
  }

  if (github_username !== undefined) {
    if (typeof github_username !== "string" || (github_username.length > 0 && !/^[a-zA-Z0-9][a-zA-Z0-9-]{0,38}$/.test(github_username))) {
      return NextResponse.json({ error: "Invalid GitHub username" }, { status: 400 });
    }
    updates.github_username = github_username;
  }

  if (avatar_url !== undefined) {
    if (avatar_url !== null) {
      const ALLOWED_MIME = ["data:image/jpeg;", "data:image/jpg;", "data:image/png;", "data:image/webp;", "data:image/gif;"];
      if (typeof avatar_url !== "string" || !ALLOWED_MIME.some(m => avatar_url.startsWith(m))) {
        return NextResponse.json({ error: "avatar_url must be a JPEG, PNG, WebP or GIF data URL" }, { status: 400 });
      }
      // ~500 KB raw ≈ 682 KB base64 (the data:...;base64, prefix adds ~30 chars)
      if (avatar_url.length > 700_000) {
        return NextResponse.json({ error: "Avatar image too large (max 500 KB)" }, { status: 413 });
      }
    }
    updates.avatar_url = avatar_url ?? undefined;
  }

  await userRepo.update(session.id, updates);

  return NextResponse.json({ success: true });
}
