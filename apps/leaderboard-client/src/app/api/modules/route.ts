import { NextResponse } from "next/server";
import { modules, type ModuleState } from "@packages/capabilities/modules";
import { fetchContributorSession } from "@/lib/contributor";

export const dynamic = "force-dynamic";

/**
 * `meetings_enabled` et `onboarding_enabled` : la forme d'avant les modules
 * génériques, lue par les écrans qui ne passent pas encore par la liste.
 * Retirés avec leurs derniers lecteurs (challenge 020, L6).
 */
function legacyFlags(states: ModuleState[]) {
  const enabled = (key: string) => states.find((state) => state.key === key)?.enabled ?? false;
  return { meetings_enabled: enabled("meetings"), onboarding_enabled: enabled("onboarding") };
}

// GET /api/modules — les modules installés et leur état, pour masquer les
// slots d'un module désactivé. Public : il ne dit rien que l'interface ne
// montre déjà. Les réglages passent par /api/modules/[key], réservé à l'admin.
export async function GET() {
  const states = await modules.all();
  return NextResponse.json({
    modules: states.map(({ key, label, description, enabled }) => ({ key, label, description, enabled })),
    ...legacyFlags(states),
  });
}

// PATCH /api/modules — admin. `{ meetings_enabled?, onboarding_enabled? }` :
// l'ancien contrat, conservé le temps de migrer l'écran des modules.
export async function PATCH(request: Request) {
  const session = await fetchContributorSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  for (const [field, key] of [["meetings_enabled", "meetings"], ["onboarding_enabled", "onboarding"]] as const) {
    if (typeof body?.[field] !== "boolean") continue;
    // Un module que la distribution n'installe pas n'a rien à changer.
    if (!(await modules.state(key))) continue;
    await modules.update(key, { enabled: body[field] }, session.id);
  }

  return NextResponse.json(legacyFlags(await modules.all()));
}
