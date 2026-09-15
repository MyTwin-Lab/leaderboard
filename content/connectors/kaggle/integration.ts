import type { IntegrationDefinition } from "../../../packages/connectors/integrations.js";

/**
 * Connexion Kaggle : un nom d'utilisateur et une clé d'API, vérifiés en listant
 * les datasets du compte. La clé est le secret ; le compte reste dans
 * `meta.username`, que le connecteur relit.
 */
export const kaggleIntegration: IntegrationDefinition = {
  key: "kaggle",
  label: "Kaggle",
  connectionLabel: "API key connection",
  description:
    "Connect your Kaggle account to enable dataset and model activity tracking. You can find your API key in your Kaggle account settings.",
  auth: {
    kind: "api_key",
    fields: [
      { name: "username", label: "Username", placeholder: "Kaggle username" },
      { name: "api_key", label: "API key", secret: true, placeholder: "API key" },
    ],
    async connect({ username, api_key: apiKey }) {
      try {
        const testRes = await fetch(
          `https://www.kaggle.com/api/v1/datasets/list?user=${encodeURIComponent(username)}&page=1`,
          {
            headers: {
              Authorization: "Basic " + Buffer.from(`${username}:${apiKey}`).toString("base64"),
              "Content-Type": "application/json",
            },
          },
        );
        if (!testRes.ok) return { ok: false, error: "Invalid Kaggle credentials" };
      } catch {
        return { ok: false, error: "Could not reach Kaggle API", status: 502 };
      }
      return { ok: true, secret: apiKey, meta: { username } };
    },
  },
  publicMeta: (meta) => (typeof meta.username === "string" ? [{ label: "Username", value: meta.username }] : []),
};
