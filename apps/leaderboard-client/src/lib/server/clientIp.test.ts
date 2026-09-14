import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../../../packages/config', () => ({
  config: { auth: { jwtSecret: 'jwt-secret-for-tests' } },
}));

import { clientIp, clientIpHash, ipHashKey } from './clientIp';
import { hashIp } from '../../../../../packages/services/sandbox/starPolicy';

function request(xff?: string) {
  const headers: Record<string, string> = {};
  if (xff !== undefined) headers['x-forwarded-for'] = xff;
  return new Request('http://localhost/api/sandboxes/sb-1/star', { headers });
}

describe('clientIp', () => {
  it("retient l'entrée du proxy de confiance, comme starPolicy", () => {
    expect(clientIp(request('1.2.3.4, 5.6.7.8'))).toBe('5.6.7.8');
  });
});

describe('clientIpHash', () => {
  it("n'utilise pas le secret JWT brut comme clé HMAC", () => {
    const hash = clientIpHash(request('203.0.113.7'));
    expect(hash).not.toBe(hashIp('203.0.113.7', 'jwt-secret-for-tests'));
    expect(hash).toBe(hashIp('203.0.113.7', ipHashKey('jwt-secret-for-tests')));
  });

  it('la clé dérivée est déterministe et dépend du secret', () => {
    expect(ipHashKey('a')).toBe(ipHashKey('a'));
    expect(ipHashKey('a')).not.toBe(ipHashKey('b'));
    expect(ipHashKey('a')).not.toContain('a'.repeat(2));
  });

  it("un XFF falsifié à gauche ne change pas le haché", () => {
    expect(clientIpHash(request('9.9.9.9, 203.0.113.7'))).toBe(clientIpHash(request('203.0.113.7')));
  });
});
