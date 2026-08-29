import { NextRequest, NextResponse } from "next/server";
import { AppSettingsRepository } from "@packages/database-service/repositories";
import { fetchContributorSession } from "@/lib/contributor";
import { isValidThemeKey } from "@/lib/themes";

const appSettingsRepo = new AppSettingsRepository();

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export async function PATCH(request: NextRequest) {
  const session = await fetchContributorSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { theme_key, primary_color, background_color, theme_mode } = body;

  if (theme_key !== undefined && !isValidThemeKey(theme_key)) {
    return NextResponse.json({ error: "Invalid theme_key" }, { status: 400 });
  }
  if (primary_color !== undefined && primary_color !== null && !HEX_RE.test(primary_color)) {
    return NextResponse.json({ error: "Invalid primary_color" }, { status: 400 });
  }
  if (background_color !== undefined && background_color !== null && !HEX_RE.test(background_color)) {
    return NextResponse.json({ error: "Invalid background_color" }, { status: 400 });
  }
  if (theme_mode !== undefined && theme_mode !== "dark" && theme_mode !== "light") {
    return NextResponse.json({ error: "Invalid theme_mode" }, { status: 400 });
  }

  const settings = await appSettingsRepo.update(
    { theme_key, primary_color, background_color, theme_mode },
    session.id,
  );

  return NextResponse.json({
    theme_key: settings.theme_key,
    primary_color: settings.primary_color,
    background_color: settings.background_color,
    theme_mode: settings.theme_mode,
  });
}
