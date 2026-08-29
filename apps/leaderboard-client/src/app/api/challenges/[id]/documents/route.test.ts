import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockGetSessionUser, mockIsManagerOfChallenge, mockFindByChallengeId, mockCreate } = vi.hoisted(() => ({
  mockGetSessionUser: vi.fn(),
  mockIsManagerOfChallenge: vi.fn(),
  mockFindByChallengeId: vi.fn(),
  mockCreate: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionUser: mockGetSessionUser }));
vi.mock('@/lib/server/managerAuth', () => ({ isManagerOfChallenge: mockIsManagerOfChallenge }));

vi.mock('../../../../../../../../packages/database-service/repositories', () => ({
  ChallengeDocumentRepository: class {
    findByChallengeId = mockFindByChallengeId;
    create = mockCreate;
  },
}));

import { GET, POST } from './route';

const CHALLENGE_ID = 'challenge-1';

function getDocs() {
  const req = new NextRequest(`http://localhost/api/challenges/${CHALLENGE_ID}/documents`);
  return GET(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
}

function postDoc(body: unknown) {
  const req = new NextRequest(`http://localhost/api/challenges/${CHALLENGE_ID}/documents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return POST(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSessionUser.mockResolvedValue({ id: 'admin-1', role: 'admin' });
});

describe('GET /api/challenges/[id]/documents', () => {
  it('returns the challenge documents', async () => {
    const docs = [{ uuid: 'doc-1', filename: 'notes.md' }];
    mockFindByChallengeId.mockResolvedValue(docs);

    const res = await getDocs();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(docs);
    expect(mockFindByChallengeId).toHaveBeenCalledWith(CHALLENGE_ID);
  });

  it('returns 500 when the repository throws', async () => {
    mockFindByChallengeId.mockRejectedValue(new Error('db down'));

    const res = await getDocs();

    expect(res.status).toBe(500);
  });
});

describe('POST /api/challenges/[id]/documents', () => {
  it('creates the document when the caller is admin', async () => {
    const created = { uuid: 'doc-1', filename: 'notes.md', content: '# hi' };
    mockCreate.mockResolvedValue(created);

    const res = await postDoc({ filename: 'notes.md', content: '# hi' });

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual(created);
    expect(mockCreate).toHaveBeenCalledWith({
      challenge_id: CHALLENGE_ID,
      filename: 'notes.md',
      content: '# hi',
      uploaded_by: 'admin-1',
    });
  });

  it('creates the document when the caller manages the challenge', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'manager-1', role: 'contributor' });
    mockIsManagerOfChallenge.mockResolvedValue(true);
    mockCreate.mockResolvedValue({ uuid: 'doc-1' });

    const res = await postDoc({ filename: 'notes.md', content: '# hi' });

    expect(res.status).toBe(201);
  });

  it('returns 401 when not authenticated', async () => {
    mockGetSessionUser.mockResolvedValue(null);

    const res = await postDoc({ filename: 'notes.md', content: '# hi' });

    expect(res.status).toBe(401);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns 403 for a non-admin who does not manage the challenge', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'user-1', role: 'contributor' });
    mockIsManagerOfChallenge.mockResolvedValue(false);

    const res = await postDoc({ filename: 'notes.md', content: '# hi' });

    expect(res.status).toBe(403);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns 400 when the filename does not end with .md', async () => {
    const res = await postDoc({ filename: 'notes.txt', content: '# hi' });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/\.md/);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns 400 when content is missing', async () => {
    const res = await postDoc({ filename: 'notes.md' });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Content is required');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns 400 when content exceeds 500KB', async () => {
    const res = await postDoc({ filename: 'notes.md', content: 'a'.repeat(500_001) });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/too large/i);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns 500 when the repository throws', async () => {
    mockCreate.mockRejectedValue(new Error('db down'));

    const res = await postDoc({ filename: 'notes.md', content: '# hi' });

    expect(res.status).toBe(500);
  });
});
