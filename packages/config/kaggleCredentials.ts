import { decryptToken, encryptToken } from './githubToken.js';
import { config } from './index.js';

export { encryptToken };

export async function getKaggleCredentials(): Promise<{ username: string; apiKey: string } | null> {
  try {
    const { db, app_settings } = await import('../database-service/db/drizzle.js');
    const { eq } = await import('drizzle-orm');
    const [row] = await db.select().from(app_settings).where(eq(app_settings.id, 1));
    if (row?.kaggle_key_enc && row?.kaggle_key_iv && row?.kaggle_username) {
      return {
        username: row.kaggle_username,
        apiKey: decryptToken(row.kaggle_key_enc, row.kaggle_key_iv),
      };
    }
  } catch {
    // DB unavailable or no credentials stored — fall through to .env
  }

  if (config.kaggle.username && config.kaggle.apiKey) {
    return { username: config.kaggle.username, apiKey: config.kaggle.apiKey };
  }

  return null;
}
