import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockGetSessionUser, mockIsManagerOfChallenge, mockFindById, mockDelete } = vi.hoisted(() => ({
  mockGetSessionUser: vi.fn(),
  mockIsManagerOfChallenge: vi.fn(),
  mockFindById: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionUser: mockGetSessionUser }));
vi.mock('@/lib/server/managerAuth', () => ({ isManagerOfChallenge: mockIsManagerOfChallenge }));

vi.mock('../../../../../../../../../packages/database-service/repositories', () => ({
  ChallengeDocumentRepository: class {
    findById = mockFindById;
    delete = mockDelete;
  },
}));

import { DELETE } from './route';

const CHALLENGE_ID = 'challenge-1';
const DOC_ID = 'doc-1';

function deleteDoc() {
  const req = new NextRequest(`http://localhost/api/challenges/${CHALLENGE_ID}/documents/${DOC_ID}`, {
    method: 'DELETE',
  });
  return DELETE(req, { params: Promise.resolve({ id: CHALLENGE_ID, docId: DOC_ID }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSessionUser.mockResolvedValue({ id: 'admin-1', role: 'admin' });
  mockFindById.mockResolvedValue({ uuid: DOC_ID, challenge_id: CHALLENGE_ID, filename: 'notes.md' });
  mockDelete.mockResolvedValue(undefined);
});

describe('DELETE /api/challenges/[id]/documents/[docId]', () => {
  it('deletes the document when the caller is admin', async () => {
    const res = await deleteDoc();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(mockDelete).toHaveBeenCalledWith(DOC_ID);
  });

  it('deletes the document when the caller manages the challenge', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'manager-1', role: 'contributor' });
    mockIsManagerOfChallenge.mockResolvedValue(true);

    const res = await deleteDoc();

    expect(res.status).toBe(200);
    expect(mockDelete).toHaveBeenCalledWith(DOC_ID);
  });

  it('returns 401 when not authenticated', async () => {
    mockGetSessionUser.mockResolvedValue(null);

    const res = await deleteDoc();

    expect(res.status).toBe(401);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('returns 403 for a non-admin who does not manage the challenge', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'user-1', role: 'contributor' });
    mockIsManagerOfChallenge.mockResolvedValue(false);

    const res = await deleteDoc();

    expect(res.status).toBe(403);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('returns 404 when the document does not exist', async () => {
    mockFindById.mockResolvedValue(null);

    const res = await deleteDoc();

    expect(res.status).toBe(404);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('returns 400 when the document belongs to a different challenge', async () => {
    mockFindById.mockResolvedValue({ uuid: DOC_ID, challenge_id: 'other-challenge', filename: 'notes.md' });

    const res = await deleteDoc();

    expect(res.status).toBe(400);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('returns 500 when the repository throws', async () => {
    mockFindById.mockRejectedValue(new Error('db down'));

    const res = await deleteDoc();

    expect(res.status).toBe(500);
  });
});
