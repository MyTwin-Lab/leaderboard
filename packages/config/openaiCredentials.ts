import { decryptToken, encryptToken } from './githubToken.js';
import { config } from './index.js';

export { encryptToken };

export async function getOpenAIApiKey(): Promise<string | null> {
  try {
    const { db, app_settings } = await import('../database-service/db/drizzle.js');
    const { eq } = await import('drizzle-orm');
    const [row] = await db.select().from(app_settings).where(eq(app_settings.id, 1));
    if (row?.openai_key_enc && row?.openai_key_iv) {
      return decryptToken(row.openai_key_enc, row.openai_key_iv);
    }
  } catch {
    // DB unavailable or no credentials stored — fall through to .env
  }

  return config.openai.apiKey ?? null;
}
