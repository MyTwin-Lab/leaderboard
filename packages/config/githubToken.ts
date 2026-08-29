import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { config } from './index.js';

function getKey(): Buffer {
  const hexKey = process.env.GITHUB_TOKEN_ENCRYPTION_KEY ?? config.githubOAuth.encryptionKey ?? '';
  if (!hexKey || hexKey.length !== 64) {
    throw new Error('[githubToken] GITHUB_TOKEN_ENCRYPTION_KEY must be 64 hex chars (32 bytes)');
  }
  return Buffer.from(hexKey, 'hex');
}

export function encryptToken(token: string): { enc: string; iv: string } {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    enc: Buffer.concat([encrypted, tag]).toString('base64'),
    iv: iv.toString('hex'),
  };
}

export function decryptToken(enc: string, ivHex: string): string {
  const key = getKey();
  const iv = Buffer.from(ivHex, 'hex');
  const data = Buffer.from(enc, 'base64');
  const tag = data.subarray(data.length - 16);
  const ciphertext = data.subarray(0, data.length - 16);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

export async function getGithubToken(): Promise<string | null> {
  try {
    const { db, app_settings } = await import('../database-service/db/drizzle.js');
    const { eq } = await import('drizzle-orm');
    const [row] = await db.select().from(app_settings).where(eq(app_settings.id, 1));
    if (row?.github_token_enc && row?.github_token_iv) {
      return decryptToken(row.github_token_enc, row.github_token_iv);
    }
  } catch {
    // DB unavailable or no token stored — fall through to .env
  }
  return config.github.token ?? null;
}
