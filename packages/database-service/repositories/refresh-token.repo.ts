import { db, refresh_tokens } from "../db/drizzle.js";
import { eq, lt } from "drizzle-orm";
import { toDomainRefreshToken, toDbRefreshToken } from "../db/mappers.js";
import type { RefreshToken } from "../domain/entities.js";
import { refreshTokenSchema } from "../domain/schemas_zod.js";

export class RefreshTokenRepository {
  /**
   * Créer un nouveau refresh token
   */
  async create(entity: Omit<RefreshToken, "id" | "created_at">): Promise<RefreshToken> {
    const validated = refreshTokenSchema.omit({ id: true, created_at: true }).parse(entity);
    const dbData = toDbRefreshToken(validated);
    const [inserted] = await db.insert(refresh_tokens).values(dbData).returning();
    return toDomainRefreshToken(inserted);
  }

  /**
   * Supprimer un refresh token par son hash
   */
  async deleteByHash(tokenHash: string): Promise<void> {
    await db.delete(refresh_tokens).where(eq(refresh_tokens.token_hash, tokenHash));
  }

  /**
   * Supprimer tous les refresh tokens d'un utilisateur
   */
  async deleteAllByUserId(userId: string): Promise<void> {
    await db.delete(refresh_tokens).where(eq(refresh_tokens.user_id, userId));
  }

  /**
   * Trouver un refresh token par son hash
   */
  async findByHash(tokenHash: string): Promise<RefreshToken | null> {
    const [row] = await db
      .select()
      .from(refresh_tokens)
      .where(eq(refresh_tokens.token_hash, tokenHash));
    
    return row ? toDomainRefreshToken(row) : null;
  }

  /**
   * Nettoyer les tokens expirés
   */
  async cleanupExpired(): Promise<number> {
    const result = await db
      .delete(refresh_tokens)
      .where(lt(refresh_tokens.expires_at, new Date()));
    
    return result.rowCount || 0;
  }

  /**
   * Récupérer tous les tokens d'un utilisateur
   */
  async findByUserId(userId: string): Promise<RefreshToken[]> {
    const rows = await db
      .select()
      .from(refresh_tokens)
      .where(eq(refresh_tokens.user_id, userId));
    
    return rows.map(toDomainRefreshToken);
  }
}