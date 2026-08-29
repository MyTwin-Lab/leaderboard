import { describe, it, expect, afterEach } from 'vitest';

import { GET } from './route';

const ORIGINAL_ENV = process.env.NODE_ENV;

afterEach(() => {
  (process.env as any).NODE_ENV = ORIGINAL_ENV;
});

describe('GET /api/docs', () => {
  it('returns 404 when not running in development', async () => {
    (process.env as any).NODE_ENV = 'production';

    const res = await GET();

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Not found' });
  });

  it('returns the Scalar HTML docs page in development', async () => {
    (process.env as any).NODE_ENV = 'development';

    const res = await GET();

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/html');
    const html = await res.text();
    expect(html).toContain('<title>Leaderboard API Docs</title>');
    expect(html).toContain('data-url="/api/openapi.json"');
    expect(html).toContain('@scalar/api-reference');
  });
});
