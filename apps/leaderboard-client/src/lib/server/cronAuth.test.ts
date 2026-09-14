import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isCronAuthorized } from './cronAuth';

const ORIGINAL_CRON_SECRET = process.env.CRON_SECRET;

function request(authHeader?: string) {
  const headers: Record<string, string> = {};
  if (authHeader !== undefined) headers.authorization = authHeader;
  return new Request('http://localhost/api/cron/digest', { headers });
}

beforeEach(() => {
  process.env.CRON_SECRET = 'test-cron-secret';
});

afterEach(() => {
  process.env.CRON_SECRET = ORIGINAL_CRON_SECRET;
});

describe('isCronAuthorized', () => {
  it('accepte le bon bearer', () => {
    expect(isCronAuthorized(request('Bearer test-cron-secret'))).toBe(true);
  });

  it("refuse sans en-tête d'autorisation", () => {
    expect(isCronAuthorized(request())).toBe(false);
  });

  it('refuse un secret faux de même longueur', () => {
    expect(isCronAuthorized(request('Bearer test-cron-secreX'))).toBe(false);
  });

  it("refuse un secret de longueur différente sans lever d'exception", () => {
    expect(() => isCronAuthorized(request('Bearer x'))).not.toThrow();
    expect(isCronAuthorized(request('Bearer x'))).toBe(false);
    expect(isCronAuthorized(request('Bearer test-cron-secret-and-more'))).toBe(false);
  });

  it('refuse le secret nu, sans le préfixe Bearer', () => {
    expect(isCronAuthorized(request('test-cron-secret'))).toBe(false);
  });

  it("refuse tout quand CRON_SECRET n'est pas configuré", () => {
    delete process.env.CRON_SECRET;
    expect(isCronAuthorized(request('Bearer '))).toBe(false);
    expect(isCronAuthorized(request('Bearer undefined'))).toBe(false);
  });
});
