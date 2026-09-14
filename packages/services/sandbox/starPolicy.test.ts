import { describe, it, expect } from "vitest";
import {
  DEFAULT_TRUSTED_PROXY_HOPS,
  FALLBACK_CLIENT_IP,
  IP_HASH_RETENTION_DAYS,
  STAR_RATE_LIMIT_PER_HOUR,
  hashIp,
  ipHashRetentionCutoff,
  isRateLimited,
  pickClientIp,
  rateLimitWindowStart,
  trustedProxyHops,
} from "./starPolicy.js";

describe("hashIp", () => {
  it("est déterministe", () => {
    expect(hashIp("203.0.113.7", "secret")).toBe(hashIp("203.0.113.7", "secret"));
  });

  it("dépend du secret — une rotation invalide les hachés existants", () => {
    expect(hashIp("203.0.113.7", "secret-a")).not.toBe(hashIp("203.0.113.7", "secret-b"));
  });

  it("sépare deux adresses", () => {
    expect(hashIp("203.0.113.7", "secret")).not.toBe(hashIp("203.0.113.8", "secret"));
  });

  it("tient dans varchar(64) — hexadécimal SHA-256", () => {
    const hash = hashIp("203.0.113.7", "secret");
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("ne renvoie jamais l'adresse en clair", () => {
    expect(hashIp("203.0.113.7", "secret")).not.toContain("203.0.113.7");
  });
});

describe("pickClientIp", () => {
  it("prend l'entrée ajoutée par le proxy de confiance, pas celle que le client a posée", () => {
    expect(pickClientIp({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" })).toBe("5.6.7.8");
  });

  it("un XFF falsifié ne change pas l'IP retenue", () => {
    const spoofA = { "x-forwarded-for": "9.9.9.1, 203.0.113.7" };
    const spoofB = { "x-forwarded-for": "9.9.9.2, 8.8.8.8, 203.0.113.7" };
    expect(pickClientIp(spoofA)).toBe("203.0.113.7");
    expect(pickClientIp(spoofB)).toBe("203.0.113.7");
  });

  it("remonte d'autant d'entrées que de proxys de confiance", () => {
    const headers = { "x-forwarded-for": "203.0.113.7, 198.51.100.2, 10.0.0.1" };
    expect(pickClientIp(headers, 1)).toBe("10.0.0.1");
    expect(pickClientIp(headers, 2)).toBe("198.51.100.2");
    expect(pickClientIp(headers, 3)).toBe("203.0.113.7");
  });

  it("borne à la première entrée quand la liste est plus courte que hops", () => {
    expect(pickClientIp({ "x-forwarded-for": "203.0.113.7" }, 5)).toBe("203.0.113.7");
  });

  it("ignore un hops invalide et retombe sur 1", () => {
    const headers = { "x-forwarded-for": "1.2.3.4, 5.6.7.8" };
    expect(pickClientIp(headers, 0)).toBe("5.6.7.8");
    expect(pickClientIp(headers, -2)).toBe("5.6.7.8");
    expect(pickClientIp(headers, Number.NaN)).toBe("5.6.7.8");
  });

  it("ignore les entrées vides", () => {
    expect(pickClientIp({ "x-forwarded-for": "1.2.3.4, 5.6.7.8, " })).toBe("5.6.7.8");
  });

  it("accepte une valeur unique sans virgule", () => {
    expect(pickClientIp({ "x-forwarded-for": "  203.0.113.7  " })).toBe("203.0.113.7");
  });

  it("retombe sur x-real-ip", () => {
    expect(pickClientIp({ "x-real-ip": "198.51.100.9" })).toBe("198.51.100.9");
  });

  it("retombe sur x-real-ip quand x-forwarded-for est vide", () => {
    const headers = { "x-forwarded-for": "  ", "x-real-ip": "198.51.100.9" };
    expect(pickClientIp(headers)).toBe("198.51.100.9");
  });

  it("retombe sur 127.0.0.1 sans aucun en-tête", () => {
    expect(pickClientIp({})).toBe(FALLBACK_CLIENT_IP);
  });

  it("lit aussi un Headers du runtime web", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" });
    expect(pickClientIp(headers)).toBe("10.0.0.1");
    expect(pickClientIp(new Headers())).toBe(FALLBACK_CLIENT_IP);
  });
});

describe("trustedProxyHops", () => {
  it("vaut 1 par défaut", () => {
    expect(DEFAULT_TRUSTED_PROXY_HOPS).toBe(1);
    expect(trustedProxyHops(undefined)).toBe(1);
  });

  it("lit une valeur entière positive", () => {
    expect(trustedProxyHops("2")).toBe(2);
    expect(trustedProxyHops(" 3 ")).toBe(3);
  });

  it("rejette les valeurs absurdes", () => {
    expect(trustedProxyHops("0")).toBe(1);
    expect(trustedProxyHops("-1")).toBe(1);
    expect(trustedProxyHops("abc")).toBe(1);
    expect(trustedProxyHops("1.5")).toBe(1);
    expect(trustedProxyHops("")).toBe(1);
  });
});

describe("isRateLimited", () => {
  it("laisse passer sous le plafond et bloque au plafond", () => {
    expect(isRateLimited(STAR_RATE_LIMIT_PER_HOUR - 1)).toBe(false);
    expect(isRateLimited(STAR_RATE_LIMIT_PER_HOUR)).toBe(true);
    expect(isRateLimited(STAR_RATE_LIMIT_PER_HOUR + 1)).toBe(true);
  });
});

describe("fenêtres", () => {
  const now = new Date("2026-09-09T12:00:00.000Z");

  it("la fenêtre de débit est une heure glissante", () => {
    expect(rateLimitWindowStart(now).toISOString()).toBe("2026-09-09T11:00:00.000Z");
  });

  it("la rétention des hachés est de 30 jours", () => {
    expect(IP_HASH_RETENTION_DAYS).toBe(30);
    expect(ipHashRetentionCutoff(now).toISOString()).toBe("2026-08-10T12:00:00.000Z");
  });
});
