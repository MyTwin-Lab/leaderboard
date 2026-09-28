import { config } from './index.js';

// Le chiffrement est la capacité `crypto` du core ; ré-exporté pour les appelants existants.
export { decryptToken, encryptToken } from '../capabilities/crypto.js';

/** Le token de la connexion GitHub (store des credentials), sinon `GITHUB_TOKEN`. */
export async function getGithubToken(): Promise<string | null> {
  try {
    const { credentials } = await import('../capabilities/credentials.js');
    const stored = await credentials.get('github');
    if (stored?.secret) return stored.secret;
  } catch {
    // Base indisponible ou secret illisible : repli sur l'environnement.
  }
  return config.github.token ?? null;
}
