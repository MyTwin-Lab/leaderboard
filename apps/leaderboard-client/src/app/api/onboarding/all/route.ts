import { NextResponse } from "next/server";
import { OnboardingProgressRepository } from "@packages/database-service/repositories";
import { fetchContributorSession } from "@/lib/contributor";
import { moduleNotFoundResponse } from "@/lib/server/modules";

const onboardingRepo = new OnboardingProgressRepository();

export async function GET() {
  const session = await fetchContributorSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const disabled = await moduleNotFoundResponse("onboarding");
  if (disabled) return disabled;

  const all = await onboardingRepo.findAllWithUsers();
  return NextResponse.json(all);
}
