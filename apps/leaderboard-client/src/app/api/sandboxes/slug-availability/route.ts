import { NextRequest, NextResponse } from "next/server";
import { SLUG_FALLBACK } from "../../../../../../../packages/database-service/domain/slug";
import { verifyRequestToken } from "@/lib/auth";
import { repositories } from "@/lib/db";
import { canCreateSandbox } from "@/lib/server/sandboxAuth";
import { checkSlugAvailability } from "@/lib/server/slugs";

export const dynamic = "force-dynamic";

/**
 * GET /api/sandboxes/slug-availability?slug=<slug>&exclude=<uuid>
 *
 * Le pendant de `/api/challenges/slug-availability` pour la modale de
 * proposition, dans l'espace de noms des sandboxes. Comme toute route
 * `/api/sandboxes/**`, hors du matcher du proxy : l'authentification se fait
 * ici, et seuls les rôles qui peuvent créer un sandbox y ont accès.
 */
export async function GET(request: NextRequest) {
  const session = await verifyRequestToken(request);
  if (!session) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!canCreateSandbox(session.role)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const availability = await checkSlugAvailability(
    repositories.sandbox,
    searchParams.get("slug") ?? "",
    SLUG_FALLBACK.sandbox,
    searchParams.get("exclude"),
  );
  return NextResponse.json(availability);
}
