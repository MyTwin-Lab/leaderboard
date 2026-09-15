import { encryptToken } from './githubToken.js';
import { config } from './index.js';

export { encryptToken };

/** Le token du bot Slack (store des credentials), sinon `SLACK_BOT_TOKEN`. */
export async function getSlackToken(): Promise<string | null> {
  try {
    const { credentials } = await import('../capabilities/credentials.js');
    const stored = await credentials.get('slack');
    if (stored?.secret) return stored.secret;
  } catch {
    // Base indisponible ou secret illisible : repli sur l'environnement.
  }

  return config.slack.botToken ?? null;
}
