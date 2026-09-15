import { NextRequest, NextResponse } from "next/server";
import { SLUG_FALLBACK } from "../../../../../../../packages/database-service/domain/slug";
import { verifyRequestToken } from "@/lib/auth";
import { repositories } from "@/lib/db";
import { checkSlugAvailability } from "@/lib/server/slugs";

export const dynamic = "force-dynamic";

/**
 * GET /api/challenges/slug-availability?slug=<slug>&exclude=<uuid>
 *
 * Ce que le champ slug du tiroir de création interroge pendant la frappe. La
 * vraie garantie reste l'index unique : cette route ne réserve rien, elle
 * évite seulement de découvrir le conflit à l'envoi.
 *
 * Réservée à qui peut créer un challenge — un admin, ou le manager d'au moins
 * un projet : répondre « pris » dit qu'un challenge porte ce slug, brouillons
 * compris, ce qu'un contributeur n'a pas à apprendre.
 */
export async function GET(request: NextRequest) {
  const session = await verifyRequestToken(request);
  if (!session) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  if (session.role !== "admin") {
    const managed = await repositories.project.findByManagerId(session.userId);
    if (managed.length === 0) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const availability = await checkSlugAvailability(
    repositories.challenge,
    searchParams.get("slug") ?? "",
    SLUG_FALLBACK.challenge,
    searchParams.get("exclude"),
  );
  return NextResponse.json(availability);
}
