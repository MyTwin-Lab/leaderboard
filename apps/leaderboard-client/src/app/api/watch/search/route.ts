import { NextRequest, NextResponse } from "next/server";
import { verifyRequestToken } from "@/lib/auth";
import { moduleNotFoundResponse } from "@/lib/server/modules";
import { OpenAlexError } from "@/lib/server/openalex";
import { parseWatchSearchQuery } from "@/lib/server/watch/query";
import { searchWatch, WatchNotConfiguredError } from "@/lib/server/watch/search";
import { WATCH_MODULE } from "@/lib/server/watch/settings";
import type { WatchSearchError } from "@/lib/watch";

export const dynamic = "force-dynamic";

/**
 * GET /api/watch/search — une page de publications santé, depuis OpenAlex.
 *
 * Réservée aux sessions : `/api/watch` est dans le matcher du proxy
 * (`distribution/modules/watch.proxy.ts`), qui rafraîchit un jeton expiré et
 * refuse l'anonyme ; la route revérifie la session elle-même. Module
 * désactivé → 404, comme si la route n'existait pas.
 *
 * `page_size` vient des réglages du module, jamais du client ; `page` est
 * borné à 40 (OpenAlex limite la pagination simple à 10 000 résultats).
 */
export async function GET(request: NextRequest) {
  const disabled = await moduleNotFoundResponse(WATCH_MODULE);
  if (disabled) return disabled;

  const session = await verifyRequestToken(request);
  if (!session) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const parsed = parseWatchSearchQuery(request.nextUrl.searchParams);
  if (!parsed.ok) return NextResponse.json({ error: "Invalid query", details: parsed.error }, { status: 400 });

  try {
    return NextResponse.json(await searchWatch(parsed.query));
  } catch (error) {
    if (error instanceof WatchNotConfiguredError) {
      const body: WatchSearchError = { error: error.message, kind: "not_configured" };
      return NextResponse.json(body, { status: 503 });
    }
    if (error instanceof OpenAlexError) {
      // Un 400 d'OpenAlex est une requête que nous avons mal construite, pas une panne.
      const status = error.kind === "invalid" ? 502 : error.kind === "rate_limited" ? 429 : error.kind === "timeout" ? 504 : 502;
      const body: WatchSearchError = { error: error.message, kind: error.kind };
      return NextResponse.json(body, { status });
    }
    console.error("[watch] search failed", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
