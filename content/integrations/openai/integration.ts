import type { IntegrationDefinition } from "../../../packages/connectors/integrations.js";

/**
 * Connexion OpenAI : la clé d'API des agents (évaluation, détection des
 * signaux Slack, analyse des meetings), vérifiée en listant les modèles.
 */
export const openaiIntegration: IntegrationDefinition = {
  key: "openai",
  label: "OpenAI",
  connectionLabel: "API key connection",
  description:
    "Connect an OpenAI API key to run AI evaluations, Slack signal detection and meeting analysis.",
  auth: {
    kind: "api_key",
    fields: [{ name: "api_key", label: "API key", secret: true, placeholder: "API key (sk-…)" }],
    async connect({ api_key: apiKey }) {
      try {
        const testRes = await fetch("https://api.openai.com/v1/models", {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (!testRes.ok) return { ok: false, error: "Invalid OpenAI API key" };
      } catch {
        return { ok: false, error: "Could not reach OpenAI API", status: 502 };
      }
      return { ok: true, secret: apiKey };
    },
  },
};
