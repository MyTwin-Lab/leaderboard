import {
  ExternalConnector,
  ConnectorAuthConfig,
  ExternalItem,
  ConnectorType,
} from "../interfaces.js";

/**
 * Connecteur Slack (bot token).
 *
 * Scopes requis sur l'app Slack : `channels:read`, `channels:history`,
 * `users:read`, `users:read.email` — et le bot doit être invité dans le canal
 * (`/invite @bot`). V1 : messages du canal uniquement, les réponses en thread
 * (conversations.replies) ne sont pas récupérées.
 */
export interface SlackConnectorOptions {
  /** Bot token Slack (xoxb-...) */
  token: string;

  /** Canal par défaut pour fetchItems */
  channelId?: string;
}

export interface FetchMessagesOptions {
  /** Canal à lire (prioritaire sur celui du constructeur) */
  channelId?: string;

  /** Curseur ts Slack — exclusif : seuls les messages strictement plus récents sont retournés */
  oldest?: string;

  /** Nombre maximum de messages à récupérer */
  maxMessages?: number;
}

export interface SlackChannel {
  id: string;
  name: string;
}

const SLACK_API = "https://slack.com/api";

export class SlackConnector implements ExternalConnector {
  readonly name = "Slack Connector";
  readonly type: ConnectorType = "slack";
  readonly authConfig: ConnectorAuthConfig;

  private token: string;
  private channelId?: string;
  private profileCache = new Map<string, { email: string | null; name: string | null }>();

  constructor(options: SlackConnectorOptions) {
    this.authConfig = { token: options.token };
    this.token = options.token;
    this.channelId = options.channelId;
  }

  /**
   * Appel générique à l'API Web Slack. Slack répond HTTP 200 avec `{ ok: false }`
   * en cas d'erreur applicative : on lève dans ce cas. Sur un 429, on attend
   * `Retry-After` et on rejoue une fois.
   */
  private async call(method: string, params: Record<string, string> = {}, retried = false): Promise<any> {
    const res = await fetch(`${SLACK_API}/${method}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(params).toString(),
    });

    if (res.status === 429 && !retried) {
      const retryAfter = Number(res.headers.get("retry-after") ?? "5");
      await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
      return this.call(method, params, true);
    }

    const data = await res.json();
    if (!data.ok) {
      throw new Error(`Slack API ${method} failed: ${data.error ?? "unknown_error"}`);
    }
    return data;
  }

  async connect(): Promise<void> {
    await this.call("auth.test");
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.call("auth.test");
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Récupère les messages d'un canal, du plus ancien au plus récent, depuis le
   * curseur `oldest` (exclusif). Les messages système (subtype: channel_join,
   * bot_message, ...) sont filtrés.
   */
  async fetchItems(options?: FetchMessagesOptions): Promise<ExternalItem[]> {
    const channelId = options?.channelId ?? this.channelId;
    if (!channelId) {
      throw new Error("SlackConnector.fetchItems: no channelId provided");
    }
    const maxMessages = options?.maxMessages ?? 1000;

    const items: ExternalItem[] = [];
    let cursor: string | undefined;

    do {
      const params: Record<string, string> = {
        channel: channelId,
        limit: "200",
      };
      if (options?.oldest) params.oldest = options.oldest;
      if (cursor) params.cursor = cursor;

      const data = await this.call("conversations.history", params);

      for (const msg of data.messages ?? []) {
        if (msg.subtype) continue; // messages système / bots
        if (!msg.user || !msg.text) continue;
        items.push({
          id: msg.ts,
          name: String(msg.text).slice(0, 120),
          type: "message",
          metadata: {
            ts: msg.ts,
            user: msg.user,
            text: msg.text,
            thread_ts: msg.thread_ts,
          },
        });
      }

      cursor = data.response_metadata?.next_cursor || undefined;
    } while (cursor && items.length < maxMessages);

    // conversations.history retourne du plus récent au plus ancien — on remet
    // en ordre chronologique pour le contexte LLM.
    items.sort((a, b) => Number(a.metadata!.ts) - Number(b.metadata!.ts));
    return items.slice(0, maxMessages);
  }

  async fetchItemContent(itemId: string): Promise<any> {
    const channelId = this.channelId;
    if (!channelId) {
      throw new Error("SlackConnector.fetchItemContent: no channelId provided");
    }
    const data = await this.call("conversations.history", {
      channel: channelId,
      latest: itemId,
      oldest: itemId,
      inclusive: "true",
      limit: "1",
    });
    return data.messages?.[0] ?? null;
  }

  /** Résout email + display name d'un utilisateur Slack (users.info), avec cache. */
  async resolveUserProfile(slackUserId: string): Promise<{ email: string | null; name: string | null }> {
    const cached = this.profileCache.get(slackUserId);
    if (cached) return cached;

    let profile: { email: string | null; name: string | null } = { email: null, name: null };
    try {
      const data = await this.call("users.info", { user: slackUserId });
      profile = {
        email: data.user?.profile?.email ?? null,
        name: data.user?.profile?.display_name || data.user?.real_name || data.user?.name || null,
      };
    } catch {
      // utilisateur supprimé ou scope users.read.email manquant — non résolu
    }
    this.profileCache.set(slackUserId, profile);
    return profile;
  }

  async resolveUserEmail(slackUserId: string): Promise<string | null> {
    return (await this.resolveUserProfile(slackUserId)).email;
  }

  /** Liste les canaux publics non archivés accessibles au bot. */
  async listChannels(): Promise<SlackChannel[]> {
    const channels: SlackChannel[] = [];
    let cursor: string | undefined;

    do {
      const params: Record<string, string> = {
        types: "public_channel",
        exclude_archived: "true",
        limit: "200",
      };
      if (cursor) params.cursor = cursor;

      const data = await this.call("conversations.list", params);
      for (const ch of data.channels ?? []) {
        channels.push({ id: ch.id, name: ch.name });
      }
      cursor = data.response_metadata?.next_cursor || undefined;
    } while (cursor);

    channels.sort((a, b) => a.name.localeCompare(b.name));
    return channels;
  }

  async disconnect(): Promise<void> {
    // Rien à nettoyer pour l'API Slack
  }
}
