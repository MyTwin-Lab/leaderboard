import { NextResponse } from "next/server";
import { modules } from "@packages/capabilities/modules";

export const dynamic = "force-dynamic";

// GET /api/modules — les modules installés et leur état, pour masquer les
// slots d'un module désactivé. Public : il ne dit rien que l'interface ne
// montre déjà. Les réglages passent par /api/modules/[key], réservé à l'admin.
export async function GET() {
  const states = await modules.all();
  return NextResponse.json({
    modules: states.map(({ key, label, description, enabled }) => ({ key, label, description, enabled })),
  });
}
