import { MessageReaction, PartialMessageReaction, PartialUser, User } from "discord.js";

type Params = {
  thanksEmojis: string[];
  apiUrl: string;
  triggerSecret: string;
};

const seen = new Map<string, number>();
const TTL_MS = 10 * 60 * 1000;

function isDuplicate(key: string): boolean {
  const now = Date.now();
  for (const [k, t] of seen) {
    if (now - t > TTL_MS) seen.delete(k);
  }
  if (seen.has(key)) return true;
  seen.set(key, now);
  return false;
}

export async function handleReactionAdd(
  reaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser,
  params: Params
): Promise<void> {
  try {
    if ("bot" in user && user.bot) return;

    if (reaction.partial) await reaction.fetch();
    if (reaction.message?.partial) await reaction.message.fetch();

    const emojiName = reaction.emoji?.name ?? "";
    if (!params.thanksEmojis.includes(emojiName)) return;

    const key = `${reaction.message.id}:${user.id}:${emojiName}`;
    if (isDuplicate(key)) return;

    const msg = reaction.message;

    if (msg.author?.id && msg.author.id === user.id) return;
    if (msg.author?.bot) return;

    const helper = {
      discord_id: msg.author!.id,
      username: msg.author!.username,
    };
    const beneficiary = {
      discord_id: user.id,
      username: (user as User).username ?? user.id,
    };

    console.log(`\n🙏 Réaction ${emojiName} détectée`);
    console.log(`   Helper      : ${helper.username} (${helper.discord_id})`);
    console.log(`   Bénéficiaire: ${beneficiary.username} (${beneficiary.discord_id})`);
    console.log(`   Channel     : ${msg.channelId} | Message : ${msg.id}`);
    console.log(`   → POST ${params.apiUrl}/api/discord/trigger ...`);

    const res = await fetch(`${params.apiUrl}/api/discord/trigger`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${params.triggerSecret}`,
      },
      body: JSON.stringify({
        channel_id: msg.channelId,
        trigger_message_id: msg.id,
        emoji: emojiName,
        helper,
        beneficiary,
      }),
    });

    const data = await res.json();
    if (res.ok) {
      console.log(`✅ Pipeline OK (${res.status}) :`, JSON.stringify(data));
    } else {
      console.error(`❌ Erreur API (${res.status}) :`, JSON.stringify(data));
    }
  } catch (e) {
    console.error("Erreur handleReactionAdd :", e);
  }
}