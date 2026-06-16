/**
 * Discord Connector
 *
 * Récupère l'historique d'un channel Discord via l'API REST Discord.
 * Utilisé pour fetcher les 10-20 messages précédant un message trigger (emoji reaction).
 * Les messages sont transmis en JSON au LLM pour évaluation de la qualité d'entraide.
 */

export interface DiscordMessageItem {
  id: string;           // snowflake Discord
  author_id: string;
  author_username: string;
  content: string;
  timestamp: string;   // ISO 8601
}

export class DiscordConnector {
  private botToken: string;
  private baseUrl = "https://discord.com/api/v10";

  constructor(botToken: string) {
    this.botToken = botToken;
  }

  async fetchMessage(channelId: string, messageId: string): Promise<DiscordMessageItem | null> {
    const url = `${this.baseUrl}/channels/${channelId}/messages/${messageId}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bot ${this.botToken}`, "Content-Type": "application/json" },
    });
    if (!response.ok) return null;
    const msg: any = await response.json();
    return {
      id: msg.id,
      author_id: msg.author.id,
      author_username: msg.author.username,
      content: msg.content,
      timestamp: msg.timestamp,
    };
  }

  /**
   * Récupère les messages d'un channel avant un message donné.
   *
   * @param channelId   - ID du channel Discord
   * @param beforeMessageId - Snowflake du message trigger (non inclus dans les résultats)
   * @param limit - Nombre de messages à récupérer (défaut: 20, max Discord: 100)
   */
  async fetchMessagesBefore(
    channelId: string,
    beforeMessageId: string,
    limit = 20
  ): Promise<DiscordMessageItem[]> {
    const url = `${this.baseUrl}/channels/${channelId}/messages?before=${beforeMessageId}&limit=${limit}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bot ${this.botToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Discord API error ${response.status} on channel ${channelId}: ${text}`
      );
    }

    const raw: any[] = await response.json();

    // Discord retourne les messages du plus récent au plus ancien — on inverse
    return raw
      .reverse()
      .map((msg) => ({
        id: msg.id,
        author_id: msg.author.id,
        author_username: msg.author.username,
        content: msg.content,
        timestamp: msg.timestamp,
      }));
  }
}
