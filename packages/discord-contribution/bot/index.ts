import { fileURLToPath } from "url";
import path from "path";
import dotenv from "dotenv";
import { buildClient } from "./client.js";
import { handleReactionAdd } from "./handlers/thanksReactionLogger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const token = process.env.DISCORD_BOT_TOKEN;
if (!token) { console.error("❌ DISCORD_BOT_TOKEN manquant dans .env"); process.exit(1); }

const triggerSecret = process.env.DISCORD_TRIGGER_SECRET;
if (!triggerSecret) { console.error("❌ DISCORD_TRIGGER_SECRET manquant dans .env"); process.exit(1); }

const apiUrl = process.env.FRONTEND_URL ?? "http://localhost:3000";
const thanksEmojis = (process.env.THANKS_EMOJIS ?? "👍,🙏,❤️").split(",").map(e => e.trim());

const client = buildClient();

client.once("ready", () => {
  console.log(`✅ Bot connecté : ${client.user?.tag}`);
  console.log(`👀 Emojis surveillés : ${thanksEmojis.join(" ")}`);
  console.log(`🔗 API cible         : ${apiUrl}`);
});

client.on("messageReactionAdd", (reaction, user) =>
  handleReactionAdd(reaction as any, user as any, {
    thanksEmojis,
    apiUrl,
    triggerSecret: triggerSecret!,
  })
);

client.login(token);