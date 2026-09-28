import { config } from "../../../packages/config/index.js";
import type { IntegrationDefinition } from "../../../packages/connectors/integrations.js";

/** Lecture des dépôts, création et protection des branches, lecture des organisations. */
export const GITHUB_OAUTH_SCOPE = "repo read:org";

interface OrgMembership {
  state: string;
  role: string;
  organization: { login: string };
}

/**
 * Connexion GitHub de la plateforme : un compte admin ou owner d'une
 * organisation, par OAuth. Le token sert à lire les dépôts, à créer et protéger
 * les branches ; `meta.org` garde l'organisation retenue (la première par
 * ordre alphabétique où le compte est admin ou owner).
 */
export const githubIntegration: IntegrationDefinition = {
  key: "github",
  label: "GitHub",
  connectionLabel: "Organization connection",
  description:
    "Connect a GitHub org admin account to enable repository operations - branch creation, commit tracking, and PR management.",
  auth: {
    kind: "oauth",
    authorize({ state }) {
      const { clientId, redirectUri } = config.githubOAuth;
      if (!clientId || !redirectUri) return { error: "GitHub OAuth not configured" };

      const url = new URL("https://github.com/login/oauth/authorize");
      url.searchParams.set("client_id", clientId);
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("scope", GITHUB_OAUTH_SCOPE);
      url.searchParams.set("state", state);
      return { url: url.toString() };
    },

    async callback({ code }) {
      let accessToken: string;
      try {
        const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
          method: "POST",
          headers: { Accept: "application/json", "Content-Type": "application/json" },
          body: JSON.stringify({
            client_id: config.githubOAuth.clientId,
            client_secret: config.githubOAuth.clientSecret,
            code,
            redirect_uri: config.githubOAuth.redirectUri,
          }),
        });
        const tokenData = (await tokenRes.json()) as { access_token?: string };
        if (!tokenData.access_token) return { ok: false, error: "exchange_failed" };
        accessToken = tokenData.access_token;
      } catch {
        return { ok: false, error: "exchange_failed" };
      }

      try {
        const membershipsRes = await fetch("https://api.github.com/user/memberships/orgs?state=active", {
          headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/vnd.github+json" },
        });
        const memberships = (await membershipsRes.json()) as OrgMembership[];
        const adminOrgs = memberships
          .filter((m) => m.state === "active" && (m.role === "admin" || m.role === "owner"))
          .map((m) => m.organization.login)
          .sort();
        if (adminOrgs.length === 0) return { ok: false, error: "no_org_admin" };
        return { ok: true, secret: accessToken, meta: { org: adminOrgs[0] } };
      } catch {
        return { ok: false, error: "exchange_failed" };
      }
    },
  },
  publicMeta: (meta) => (typeof meta.org === "string" ? [{ label: "Organization", value: meta.org }] : []),
};
