import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockReadFileSync, mockParse } = vi.hoisted(() => ({
  mockReadFileSync: vi.fn(),
  mockParse: vi.fn(),
}));

vi.mock('fs', () => ({
  readFileSync: mockReadFileSync,
}));

vi.mock('yaml', () => ({
  parse: mockParse,
}));

import { GET } from './route';

function setNodeEnv(value: string) {
  vi.stubEnv('NODE_ENV', value);
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('GET /api/openapi.json', () => {
  it('returns 404 outside of development', async () => {
    setNodeEnv('production');

    const res = await GET();

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Not found' });
    expect(mockReadFileSync).not.toHaveBeenCalled();
  });

  it('returns 404 in the test environment', async () => {
    setNodeEnv('test');

    const res = await GET();

    expect(res.status).toBe(404);
  });

  it('parses and serves the YAML spec as JSON in development', async () => {
    setNodeEnv('development');
    mockReadFileSync.mockReturnValue('openapi: 3.0.0');
    const spec = { openapi: '3.0.0', info: { title: 'Leaderboard API' } };
    mockParse.mockReturnValue(spec);

    const res = await GET();

    expect(res.status).toBe(200);
    expect(mockParse).toHaveBeenCalledWith('openapi: 3.0.0');
    expect(await res.json()).toEqual(spec);
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=60');
  });

  it('returns 500 when the spec file cannot be read', async () => {
    setNodeEnv('development');
    mockReadFileSync.mockImplementation(() => {
      throw new Error('ENOENT');
    });

    const res = await GET();

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Failed to load OpenAPI spec' });
  });
});
