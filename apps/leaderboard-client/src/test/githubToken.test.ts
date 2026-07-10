import { describe, it, expect } from 'vitest';

// Set env before module import
process.env.GITHUB_TOKEN_ENCRYPTION_KEY = 'a'.repeat(64); // 32 bytes in hex

import { encryptToken, decryptToken } from '../../../../packages/config/githubToken.js';

describe('githubToken encryption', () => {
  it('round-trips a token correctly', () => {
    const original = 'ghp_testtoken123456';
    const { enc, iv } = encryptToken(original);
    expect(enc).toBeTruthy();
    expect(iv).toHaveLength(24); // 12 bytes = 24 hex chars
    const decrypted = decryptToken(enc, iv);
    expect(decrypted).toBe(original);
  });

  it('produces different ciphertext each call (random IV)', () => {
    const token = 'ghp_testtoken123456';
    const first = encryptToken(token);
    const second = encryptToken(token);
    expect(first.enc).not.toBe(second.enc);
    expect(first.iv).not.toBe(second.iv);
  });

  it('throws on corrupted ciphertext', () => {
    const { enc, iv } = encryptToken('ghp_test');
    // Corrupt the base64 by appending garbage (causes auth tag mismatch)
    const corrupt = enc.slice(0, -4) + 'XXXX';
    expect(() => decryptToken(corrupt, iv)).toThrow();
  });
});
