import "server-only";
import { NextResponse } from "next/server";
import { modules } from "@packages/capabilities/modules";

/**
 * La réponse d'une route de module désactivé ou non installé : un 404, comme
 * si la route n'existait pas. `null` quand le module est actif.
 */
export async function moduleNotFoundResponse(key: string): Promise<NextResponse | null> {
  return (await modules.enabled(key)) ? null : NextResponse.json({ error: "Not found" }, { status: 404 });
}
