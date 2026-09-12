import { NextResponse } from "next/server";
import { AppSettingsRepository } from "@packages/database-service/repositories";
import { sandboxSettingsPatchSchema } from "@packages/database-service/domain/schemas_zod";
import { fetchContributorSession } from "@/lib/contributor";

export const dynamic = "force-dynamic";

const appSettingsRepo = new AppSettingsRepository();

/**
 * PATCH /api/admin/sandbox-settings — l'économie des stars, calqué sur
 * `digest-settings`.
 *
 * Les deux champs sont indépendants : le bonus de promotion se règle sans
 * toucher aux paliers, et inversement. La validation (croissance stricte des
 * seuils, plafonds) vient de `sandboxSettingsPatchSchema` — la même que
 * consommera le formulaire admin, donc une seule règle à maintenir.
 *
 * Un palier ajouté après coup n'est **pas** payé rétroactivement : il sera
 * ramassé à la prochaine star du sandbox. Enregistrer les réglages ne doit pas
 * déclencher un paiement en masse involontaire (§4.2 du plan).
 */
export async function PATCH(request: Request) {
  const session = await fetchContributorSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const parsed = sandboxSettingsPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const patch = parsed.data;
  if (patch.sandbox_star_tiers === undefined && patch.sandbox_promotion_bonus_cp === undefined) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const updated = await appSettingsRepo.update(patch, session.id);
  return NextResponse.json({
    sandbox_star_tiers: updated.sandbox_star_tiers,
    sandbox_promotion_bonus_cp: updated.sandbox_promotion_bonus_cp,
  });
}
