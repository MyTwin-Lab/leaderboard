import { encryptToken } from './githubToken.js';
import { config } from './index.js';

export { encryptToken };

/** La connexion Kaggle (store des credentials, compte dans `meta.username`), sinon l'environnement. */
export async function getKaggleCredentials(): Promise<{ username: string; apiKey: string } | null> {
  try {
    const { credentials } = await import('../capabilities/credentials.js');
    const stored = await credentials.get('kaggle');
    const username = stored?.meta.username;
    if (stored?.secret && typeof username === 'string' && username) {
      return { username, apiKey: stored.secret };
    }
  } catch {
    // Base indisponible ou secret illisible : repli sur l'environnement.
  }

  if (config.kaggle.username && config.kaggle.apiKey) {
    return { username: config.kaggle.username, apiKey: config.kaggle.apiKey };
  }

  return null;
}
