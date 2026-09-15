import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { decryptToken, encryptToken } from "./crypto.js";

const KEY = "a".repeat(64);
let previous: string | undefined;

beforeEach(() => {
  previous = process.env.GITHUB_TOKEN_ENCRYPTION_KEY;
  process.env.GITHUB_TOKEN_ENCRYPTION_KEY = KEY;
});

afterEach(() => {
  if (previous === undefined) delete process.env.GITHUB_TOKEN_ENCRYPTION_KEY;
  else process.env.GITHUB_TOKEN_ENCRYPTION_KEY = previous;
});

describe("crypto", () => {
  it("round-trips a secret with a fresh IV each time", () => {
    const first = encryptToken("ghp_secret");
    const second = encryptToken("ghp_secret");

    expect(first.iv).not.toBe(second.iv);
    expect(decryptToken(first.enc, first.iv)).toBe("ghp_secret");
    expect(decryptToken(second.enc, second.iv)).toBe("ghp_secret");
  });

  it("refuses a tampered ciphertext", () => {
    const { enc, iv } = encryptToken("ghp_secret");
    const bytes = Buffer.from(enc, "base64");
    bytes[0] ^= 0xff;

    expect(() => decryptToken(bytes.toString("base64"), iv)).toThrow();
  });

  it("refuses to run without a 64-character key", () => {
    process.env.GITHUB_TOKEN_ENCRYPTION_KEY = "short";

    expect(() => encryptToken("ghp_secret")).toThrow("must be 64 hex chars");
  });
});
