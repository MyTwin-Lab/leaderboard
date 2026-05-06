import type { Contribution } from "./types";

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
  context: {
    id: string;
    createdAt: string;
    authorId: string;
    authorTag: string;
    content: string;
    attachments: string[];
  }[];
}

export function buildContribution(event: DiscordThanksEvent): Contribution {
  const sortedContext = [...event.context].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const mainMessage =
    sortedContext.find((msg) => msg.id === event.messageId) ??
    sortedContext[sortedContext.length - 1];

  const questionMessage = [...sortedContext]
    .reverse()
    .find(
      (msg) =>
        msg.id !== event.messageId &&
        msg.authorId !== event.messageAuthorId &&
        msg.content &&
        msg.content.trim().length > 0
    );

  const shortContent = (mainMessage?.content || "Discord contribution")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);

  const formattedContext = sortedContext
    .map((msg) => {
      const content = msg.content?.trim() || "[no text]";
      const attachmentInfo =
        msg.attachments && msg.attachments.length > 0
          ? ` | attachments: ${msg.attachments.join(", ")}`
          : "";
      return `[${msg.authorTag}] ${content}${attachmentInfo}`;
    })
    .join("\n");

  const description = [
    `Discord help interaction detected.`,
    ``,
    `Channel: #${event.channelName}`,
    `Reaction emoji: ${event.emoji}`,
    `Message author: ${event.messageAuthorTag}`,
    `Reacted by: ${event.reactedByTag}`,
    ``,
    `Target message:`,
    mainMessage?.content?.trim() || "[no text]",
    ``,
    `Possible question or prior context:`,
    questionMessage?.content?.trim() || "[not found]",
    ``,
    `Conversation context:`,
    formattedContext,
    ``,
    `Interpretation:`,
    `A Discord message received a gratitude-style reaction, which may indicate that the message was perceived as helpful or valuable in the conversation.`
  ].join("\n");

  return {
    title: `Discord help: ${shortContent || "message"}`,
    type: "dataset",
    description,
    challenge_id: "discord-help",
    tags: ["discord", "community", "help-interaction"],
    userId: event.messageAuthorId,
    commitShas: []
  };
}