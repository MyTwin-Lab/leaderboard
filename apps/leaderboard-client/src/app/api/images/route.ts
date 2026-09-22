import { NextRequest, NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { repositories } from "@/lib/db";

/**
 * Le dépôt d'une image — pour l'instant, la couverture d'un challenge ou d'une
 * proposition sandbox.
 *
 * Le corps est du JSON et non du multipart : l'interface réduit l'image dans
 * un canvas avant de l'envoyer (voir `CoverImageField`), et ce qu'elle a en
 * main à ce moment-là est une data URL. Inutile de la repasser en `FormData`
 * des deux côtés.
 *
 * Le plafond est bas volontairement : une couverture réduite à 1600 px de
 * large en WebP pèse quelques centaines de kilo-octets. Au-delà, c'est qu'un
 * appelant a contourné la réduction.
 */

const MAX_BYTES = 3 * 1024 * 1024;

const ALLOWED_TYPES = new Set(["image/webp", "image/png", "image/jpeg", "image/avif", "image/gif"]);

/** Accepte aussi bien une data URL qu'un base64 nu, et rend le couple type/octets. */
function decodeImage(raw: string, declaredType: string | undefined) {
  // `[\s\S]` plutôt que le drapeau `s` : la cible TypeScript du projet est
  // antérieure à ES2018, qui l'a introduit.
  const dataUrl = /^data:([^;,]+);base64,([\s\S]*)$/.exec(raw.trim());
  const mimeType = (dataUrl ? dataUrl[1] : declaredType ?? "").toLowerCase();
  const base64 = dataUrl ? dataUrl[2] : raw.trim();
  return { mimeType, data: Buffer.from(base64, "base64") };
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { data?: unknown; mime_type?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.data !== "string" || body.data.length === 0) {
    return NextResponse.json({ error: "An image is required" }, { status: 400 });
  }

  const { mimeType, data } = decodeImage(
    body.data,
    typeof body.mime_type === "string" ? body.mime_type : undefined,
  );

  if (!ALLOWED_TYPES.has(mimeType)) {
    return NextResponse.json(
      { error: "Only PNG, JPEG, WebP, AVIF and GIF images are accepted" },
      { status: 400 },
    );
  }
  if (data.byteLength === 0) {
    return NextResponse.json({ error: "The image is empty" }, { status: 400 });
  }
  if (data.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "The image is too large (max 3 MB)" }, { status: 413 });
  }

  const image = await repositories.image.create({
    user_id: user.id,
    mime_type: mimeType,
    data,
  });

  return NextResponse.json({ url: `/api/images/${image.uuid}`, uuid: image.uuid }, { status: 201 });
}
