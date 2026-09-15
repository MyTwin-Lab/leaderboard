import { NextResponse } from "next/server";
import { modules, ModuleNotFoundError, ModuleSettingsError } from "@packages/capabilities/modules";
import { fetchContributorSession } from "@/lib/contributor";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ key: string }> };

/** La session d'un admin, ou la réponse qui refuse l'appel. */
async function adminSession() {
  const session = await fetchContributorSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return session;
}

// GET /api/modules/[key] — admin : l'état et les réglages d'un module.
export async function GET(_request: Request, { params }: Params) {
  const auth = await adminSession();
  if (auth instanceof NextResponse) return auth;

  const { key } = await params;
  const state = await modules.state(key);
  if (!state) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(state);
}

// PATCH /api/modules/[key] — admin : `{ enabled?, settings? }`. Les réglages
// fournis se fusionnent aux réglages actuels, puis passent le schéma du module.
export async function PATCH(request: Request, { params }: Params) {
  const auth = await adminSession();
  if (auth instanceof NextResponse) return auth;

  const { key } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const patch: { enabled?: boolean; settings?: Record<string, unknown> } = {};
  if (body.enabled !== undefined) {
    if (typeof body.enabled !== "boolean") return NextResponse.json({ error: "enabled must be a boolean" }, { status: 400 });
    patch.enabled = body.enabled;
  }
  if (body.settings !== undefined) {
    if (!body.settings || typeof body.settings !== "object" || Array.isArray(body.settings)) {
      return NextResponse.json({ error: "settings must be an object" }, { status: 400 });
    }
    patch.settings = body.settings;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  try {
    return NextResponse.json(await modules.update(key, patch, auth.id));
  } catch (error) {
    if (error instanceof ModuleNotFoundError) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (error instanceof ModuleSettingsError) {
      return NextResponse.json({ error: "Invalid settings", details: error.message }, { status: 400 });
    }
    throw error;
  }
}
