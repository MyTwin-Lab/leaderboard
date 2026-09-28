import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { IntegrationCredential } from "../database-service/domain/entities.js";
import { createCredentials, type CredentialStore } from "./credentials.js";

function memoryStore(): CredentialStore & { rows: Map<string, IntegrationCredential> } {
  const rows = new Map<string, IntegrationCredential>();
  return {
    rows,
    find: async (key) => rows.get(key) ?? null,
    save: async (input) => {
      const row = {
        key: input.key,
        secret_enc: input.secret_enc,
        secret_iv: input.secret_iv,
        meta: input.meta ?? {},
        connected_at: new Date(),
        connected_by: input.connected_by,
      };
      rows.set(input.key, row);
      return row;
    },
    patchMeta: async (key, patch) => {
      const row = rows.get(key);
      if (!row) return null;
      row.meta = { ...row.meta, ...patch };
      return row;
    },
    remove: async (key) => rows.delete(key),
  };
}

let previous: string | undefined;

beforeEach(() => {
  previous = process.env.GITHUB_TOKEN_ENCRYPTION_KEY;
  process.env.GITHUB_TOKEN_ENCRYPTION_KEY = "b".repeat(64);
});

afterEach(() => {
  if (previous === undefined) delete process.env.GITHUB_TOKEN_ENCRYPTION_KEY;
  else process.env.GITHUB_TOKEN_ENCRYPTION_KEY = previous;
});

describe("credentials", () => {
  it("stores the secret encrypted and gives it back in clear", async () => {
    const store = memoryStore();
    const credentials = createCredentials(store);

    await credentials.set("github", { secret: "ghp_secret", meta: { org: "MyTwin-Lab" }, connectedBy: "admin-1" });

    expect(store.rows.get("github")?.secret_enc).not.toContain("ghp_secret");
    expect(await credentials.get("github")).toMatchObject({
      key: "github",
      secret: "ghp_secret",
      meta: { org: "MyTwin-Lab" },
      connectedBy: "admin-1",
    });
  });

  it("answers null for an integration never connected", async () => {
    const credentials = createCredentials(memoryStore());

    expect(await credentials.get("slack")).toBeNull();
    expect(await credentials.status("slack")).toEqual({ connected: false, meta: {}, connectedAt: null, connectedBy: null });
  });

  it("reports the status without decrypting", async () => {
    const store = memoryStore();
    const credentials = createCredentials(store);
    await credentials.set("slack", { secret: "xoxb", meta: { team_name: "MyTwin" }, connectedBy: null });
    // Un secret illisible ne gêne pas le statut : il ne le déchiffre pas.
    store.rows.get("slack")!.secret_iv = "00";

    expect(await credentials.status("slack")).toMatchObject({ connected: true, meta: { team_name: "MyTwin" } });
  });

  it("merges meta without touching the secret, then removes the connection", async () => {
    const credentials = createCredentials(memoryStore());
    await credentials.set("scaleway", { secret: "scw", meta: { zone: "fr-par-2" }, connectedBy: null });

    await credentials.patchMeta("scaleway", { disconnect_requested_at: "2026-09-15T10:00:00Z" });

    expect(await credentials.get("scaleway")).toMatchObject({
      secret: "scw",
      meta: { zone: "fr-par-2", disconnect_requested_at: "2026-09-15T10:00:00Z" },
    });
    expect(await credentials.remove("scaleway")).toBe(true);
    expect(await credentials.get("scaleway")).toBeNull();
  });
});
