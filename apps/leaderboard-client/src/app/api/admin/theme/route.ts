import { NextRequest, NextResponse } from "next/server";
import { AppSettingsRepository } from "@packages/database-service/repositories";
import { fetchContributorSession } from "@/lib/contributor";
import { isValidThemeKey } from "@/lib/themes";

const appSettingsRepo = new AppSettingsRepository();

export async function PATCH(request: NextRequest) {
  const session = await fetchContributorSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { theme_key } = body;

  if (typeof theme_key !== "string" || !isValidThemeKey(theme_key)) {
    return NextResponse.json({ error: "Invalid theme_key" }, { status: 400 });
  }

  const settings = await appSettingsRepo.setTheme(theme_key, session.id);
  return NextResponse.json({ theme_key: settings.theme_key });
}
