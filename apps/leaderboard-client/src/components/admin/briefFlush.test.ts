import { describe, it, expect, vi } from 'vitest';
import { flushBrief } from './briefFlush';

const DOCUMENTS_URL = '/api/challenges/challenge-1/documents';

describe('flushBrief', () => {
  it('posts the brief as brief.md', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });

    const result = await flushBrief(
      'challenge-1',
      '## Context\n\nWhy this exists.',
      null,
      fetchImpl as unknown as typeof fetch
    );

    expect(result).toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledWith(DOCUMENTS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: 'brief.md', content: '## Context\n\nWhy this exists.' }),
    });
  });

  it('trims the content before sending it', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });

    await flushBrief('challenge-1', '\n\n  ## Context  \n\n', null, fetchImpl as unknown as typeof fetch);

    expect(fetchImpl).toHaveBeenCalledWith(DOCUMENTS_URL, expect.objectContaining({
      body: JSON.stringify({ filename: 'brief.md', content: '## Context' }),
    }));
  });

  it('reports a non-ok response as a failure', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false });

    const result = await flushBrief('challenge-1', '## Context', null, fetchImpl as unknown as typeof fetch);

    expect(result).toEqual({ ok: false });
  });

  it('reports a rejected fetch (network error) as a failure', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network error'));

    const result = await flushBrief('challenge-1', '## Context', null, fetchImpl as unknown as typeof fetch);

    expect(result).toEqual({ ok: false });
  });

  it('does nothing when the brief is empty and none was saved before', async () => {
    const fetchImpl = vi.fn();

    const result = await flushBrief('challenge-1', '   ', null, fetchImpl as unknown as typeof fetch);

    expect(result).toEqual({ ok: true });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('deletes the existing document when the brief is emptied', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });

    const result = await flushBrief('challenge-1', '', 'doc-1', fetchImpl as unknown as typeof fetch);

    expect(result).toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledWith(`${DOCUMENTS_URL}/doc-1`, { method: 'DELETE' });
  });

  it('reports a failed delete', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network error'));

    const result = await flushBrief('challenge-1', '', 'doc-1', fetchImpl as unknown as typeof fetch);

    expect(result).toEqual({ ok: false });
  });
});
