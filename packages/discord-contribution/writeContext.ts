import fs from "fs";
import path from "path";

interface DiscordThanksEvent {
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

export function writeContextFile(event: DiscordThanksEvent): string {
  const workspaceDir = path.join(__dirname, "..", "workspace");

  if (!fs.existsSync(workspaceDir)) {
    fs.mkdirSync(workspaceDir);
  }

  const filePath = path.join(workspaceDir, "context.txt");

  const contextLines = event.context.map((msg) => {
    const createdAt = msg.createdAt ? `[${msg.createdAt}] ` : "";
    return `${createdAt}${msg.authorTag}: ${msg.content}`;
  });

  const content = [
    `Event type: ${event.type}`,
    `Timestamp: ${event.timestamp}`,
    `Channel: ${event.channelName}`,
    `Message ID: ${event.messageId}`,
    `Message author: ${event.messageAuthorTag} (${event.messageAuthorId})`,
    `Reacted by: ${event.reactedByTag} (${event.reactedById})`,
    `Emoji: ${event.emoji}`,
    `Context before: ${event.contextBefore ?? 0}`,
    `Context after: ${event.contextAfter ?? 0}`,
    ``,
    `Conversation context:`,
    ...contextLines
  ].join("\n");

  fs.writeFileSync(filePath, content, "utf8");

  return workspaceDir;
}