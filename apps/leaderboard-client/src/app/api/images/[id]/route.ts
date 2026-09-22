import { NextRequest, NextResponse } from "next/server";

import { repositories } from "@/lib/db";

/**
 * Les octets d'une image déposée — lecture publique : une couverture s'affiche
 * sur une page publique, et sur une carte OpenGraph.
 *
 * Cache immuable : une ligne d'`images` n'est jamais réécrite. Remplacer une
 * couverture crée une nouvelle ligne et repointe `cover_image_url`, donc
 * l'URL change avec le contenu.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const image = await repositories.image.findById(id).catch(() => null);
  if (!image) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(image.data), {
    headers: {
      "Content-Type": image.mime_type,
      "Content-Length": String(image.byte_size),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
