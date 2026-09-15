import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { config } from "../config/index.js";

/**
 * Capacité `crypto`
 * -----------------
 * Chiffrement symétrique des secrets stockés en base (AES-256-GCM) : les
 * credentials des intégrations, les tokens d'accès aux instances de calcul.
 *
 * La clé vient de `GITHUB_TOKEN_ENCRYPTION_KEY` (64 caractères hexadécimaux),
 * son nom historique : la renommer imposerait de rechiffrer tout l'existant.
 */

function getKey(): Buffer {
  const hexKey = process.env.GITHUB_TOKEN_ENCRYPTION_KEY ?? config.githubOAuth.encryptionKey ?? "";
  if (!hexKey || hexKey.length !== 64) {
    throw new Error("[githubToken] GITHUB_TOKEN_ENCRYPTION_KEY must be 64 hex chars (32 bytes)");
  }
  return Buffer.from(hexKey, "hex");
}

/** Le texte chiffré (base64, tag d'authentification compris) et son IV (hex). */
export function encryptToken(token: string): { enc: string; iv: string } {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    enc: Buffer.concat([encrypted, tag]).toString("base64"),
    iv: iv.toString("hex"),
  };
}

/** Lève si le texte a été altéré ou si la clé a changé. */
export function decryptToken(enc: string, ivHex: string): string {
  const key = getKey();
  const iv = Buffer.from(ivHex, "hex");
  const data = Buffer.from(enc, "base64");
  const tag = data.subarray(data.length - 16);
  const ciphertext = data.subarray(0, data.length - 16);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
