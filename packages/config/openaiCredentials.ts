import { encryptToken } from './githubToken.js';
import { config } from './index.js';

export { encryptToken };

/** La clé de la connexion OpenAI (store des credentials), sinon `OPENAI_API_KEY`. */
export async function getOpenAIApiKey(): Promise<string | null> {
  try {
    const { credentials } = await import('../capabilities/credentials.js');
    const stored = await credentials.get('openai');
    if (stored?.secret) return stored.secret;
  } catch {
    // Base indisponible ou secret illisible : repli sur l'environnement.
  }

  return config.openai.apiKey ?? null;
}
