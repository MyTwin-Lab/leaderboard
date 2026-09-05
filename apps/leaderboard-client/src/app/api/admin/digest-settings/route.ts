import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { AppSettingsRepository } from "@packages/database-service/repositories";
import { fetchContributorSession } from "@/lib/contributor";

const appSettingsRepo = new AppSettingsRepository();

const MAX_FREQUENCY_DAYS = 365;

export async function PATCH(request: Request) {
  const session = await fetchContributorSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const patch: { digest_enabled?: boolean; digest_frequency_days?: number } = {};

  if (typeof body.digest_enabled === "boolean") {
    patch.digest_enabled = body.digest_enabled;
  }

  if (body.digest_frequency_days !== undefined) {
    const days = body.digest_frequency_days;
    // Une fréquence de 0 rendrait le digest dû en permanence, et une valeur
    // fractionnaire ne veut rien dire face à une comparaison en jours entiers.
    if (
      typeof days !== "number" ||
      !Number.isInteger(days) ||
      days < 1 ||
      days > MAX_FREQUENCY_DAYS
    ) {
      return NextResponse.json(
        { error: `digest_frequency_days must be an integer between 1 and ${MAX_FREQUENCY_DAYS}` },
        { status: 400 },
      );
    }
    patch.digest_frequency_days = days;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const updated = await appSettingsRepo.update(patch, session.id);
  return NextResponse.json({
    digest_enabled: updated.digest_enabled,
    digest_frequency_days: updated.digest_frequency_days,
  });
}
