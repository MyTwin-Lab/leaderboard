import OpenAI from "openai";
import { getOpenAIApiKey } from "../../config/openaiCredentials.js";

let client: OpenAI | null = null;
let clientKey: string | null = null;

/**
 * Client OpenAI résolu à l'appel plutôt qu'à l'import : la clé peut venir de
 * la connexion admin (app_settings, chiffrée) et changer sans redémarrage.
 * Le client est recréé uniquement quand la clé change.
 */
export async function getClient(): Promise<OpenAI> {
  const apiKey = await getOpenAIApiKey();
  if (!apiKey) {
    throw new Error("OpenAI API key is not configured (connect it in Integrations or set OPENAI_API_KEY)");
  }
  if (!client || clientKey !== apiKey) {
    client = new OpenAI({ apiKey });
    clientKey = apiKey;
  }
  return client;
}
