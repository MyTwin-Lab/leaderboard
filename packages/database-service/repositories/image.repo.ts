import { db, images } from "../db/drizzle";
import { eq } from "drizzle-orm";

/** Une image telle qu'elle est servie : ses octets et son type. */
export interface StoredImage {
  uuid: string;
  mime_type: string;
  byte_size: number;
  data: Buffer;
}

export interface ImageDraft {
  /** L'auteur du dépôt, ou `null` si son compte a disparu depuis. */
  user_id: string | null;
  mime_type: string;
  data: Buffer;
}

/**
 * ImageRepository
 * ---------------
 * Les images déposées depuis l'app — pour l'instant, les couvertures des
 * challenges et des propositions sandbox.
 *
 * Append-only : remplacer une couverture écrit une nouvelle ligne et repointe
 * `cover_image_url`. L'octet d'une image n'est donc jamais réécrit, ce qui
 * autorise `GET /api/images/<uuid>` à répondre avec un cache immuable.
 */
export class ImageRepository {
  async create(draft: ImageDraft): Promise<StoredImage> {
    const [inserted] = await db
      .insert(images)
      .values({
        user_id: draft.user_id,
        mime_type: draft.mime_type,
        byte_size: draft.data.byteLength,
        data: draft.data,
      })
      .returning();

    return {
      uuid: inserted.uuid,
      mime_type: inserted.mime_type,
      byte_size: inserted.byte_size,
      data: inserted.data,
    };
  }

  async findById(uuid: string): Promise<StoredImage | null> {
    const [row] = await db.select().from(images).where(eq(images.uuid, uuid));
    if (!row) return null;
    return {
      uuid: row.uuid,
      mime_type: row.mime_type,
      byte_size: row.byte_size,
      data: row.data,
    };
  }
}
