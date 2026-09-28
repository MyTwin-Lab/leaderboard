import type { IntegrationDefinition } from "../../../packages/connectors/integrations.js";
import type { ExternalConnector } from "../../../packages/connectors/interfaces.js";
import { ConnectorRegistry } from "../../../packages/connectors/registry.js";

/** Un connecteur de discussion capable de lister ses canaux. */
type ChannelListingConnector = ExternalConnector & {
  listChannels(): Promise<{ id: string; name: string }[]>;
};

function canListChannels(connector: ExternalConnector | null): connector is ChannelListingConnector {
  return !!connector && typeof (connector as Partial<ChannelListingConnector>).listChannels === "function";
}

/**
 * Connexion Slack : le token d'un bot, vérifié par `auth.test`. Slack répond
 * 200 avec `{ ok: false }` sur un échec d'authentification : c'est le corps qui
 * tranche. `meta.team_name` garde le nom de l'espace.
 *
 * Extra `channels` : les canaux publics accessibles au bot, pour que le manager
 * d'un challenge choisisse celui qui porte les signaux.
 */
export const slackIntegration: IntegrationDefinition = {
  key: "slack",
  label: "Slack",
  connectionLabel: "Bot token connection",
  description:
    "Connect a Slack bot to detect contribution signals in challenge channels. Create a Slack app with the scopes channels:read, channels:history, users:read and users:read.email, install it to your workspace, then paste its bot token below. Remember to invite the bot to the channels you want to track.",
  auth: {
    kind: "api_key",
    fields: [{ name: "bot_token", label: "Bot token", secret: true, placeholder: "Bot token (xoxb-…)" }],
    async connect({ bot_token: botToken }) {
      try {
        const testRes = await fetch("https://slack.com/api/auth.test", {
          method: "POST",
          headers: { Authorization: `Bearer ${botToken}` },
        });
        const data = (await testRes.json()) as { ok?: boolean; error?: string; team?: string };
        if (!data.ok) return { ok: false, error: `Invalid Slack token (${data.error ?? "auth failed"})` };
        return { ok: true, secret: botToken, meta: { team_name: data.team ?? "" } };
      } catch {
        return { ok: false, error: "Could not reach Slack API", status: 502 };
      }
    },
  },
  publicMeta: (meta) => [{ label: "Workspace", value: typeof meta.team_name === "string" && meta.team_name ? meta.team_name : "-" }],
  extras: [
    {
      key: "channels",
      access: "admin_or_manager",
      async run() {
        // Sans canal désigné, le connecteur Slack sert à lister ceux du bot. Il
        // n'est pas construit tant que Slack n'est pas connecté.
        const connector = await ConnectorRegistry.createConnector({ type: "slack" });
        if (!canListChannels(connector)) {
          return Response.json({ error: "Slack is not connected" }, { status: 400 });
        }
        try {
          return await connector.listChannels();
        } catch (error) {
          console.error("Error listing Slack channels:", error);
          return Response.json({ error: "Failed to list Slack channels" }, { status: 502 });
        }
      },
    },
  ],
};
