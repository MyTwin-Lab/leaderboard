import { NextResponse } from "next/server";
import { AppSettingsRepository } from "@packages/database-service/repositories";
import { fetchContributorSession } from "@/lib/contributor";

const appSettingsRepo = new AppSettingsRepository();

export async function GET() {
  const settings = await appSettingsRepo.get();
  return NextResponse.json({
    meetings_enabled: settings.modules_meetings_enabled,
    onboarding_enabled: settings.modules_onboarding_enabled,
  });
}

export async function PATCH(request: Request) {
  const session = await fetchContributorSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const patch: { modules_meetings_enabled?: boolean; modules_onboarding_enabled?: boolean } = {};

  if (typeof body.meetings_enabled === "boolean") {
    patch.modules_meetings_enabled = body.meetings_enabled;
  }
  if (typeof body.onboarding_enabled === "boolean") {
    patch.modules_onboarding_enabled = body.onboarding_enabled;
  }

  const updated = await appSettingsRepo.update(patch, session.id);
  return NextResponse.json({
    meetings_enabled: updated.modules_meetings_enabled,
    onboarding_enabled: updated.modules_onboarding_enabled,
  });
}
