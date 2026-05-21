import fs from "fs";
import path from "path";
import readline from "readline";

const logPath = path.join(
  __dirname,
  "..",
  "..",
  "logs",
  "discord_thanks.jsonl"
);

export interface DiscordThanksEvent {
  type: string;
  timestamp: string;
  guildId: string;
  channelId: string;
  channelName: string;
  messageId: string;
  messageAuthorId: string;
  messageAuthorTag: string;
  reactedById: string;
  reactedByTag: string;
  emoji: string;
  contextBefore?: number;
  contextAfter?: number;
  context: {
    id: string;
    createdAt: string;
    authorId: string;
    authorTag: string;
    content: string;
    attachments: string[];
  }[];
}

export async function readDiscordLogs(): Promise<DiscordThanksEvent[]> {
  const events: DiscordThanksEvent[] = [];

  const fileStream = fs.createReadStream(logPath);

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    if (!line.trim()) continue;

    try {
      const parsed = JSON.parse(line);
      events.push(parsed);
    } catch (err) {
      console.error("Invalid JSON line:", line);
    }
  }

  return events;
}
