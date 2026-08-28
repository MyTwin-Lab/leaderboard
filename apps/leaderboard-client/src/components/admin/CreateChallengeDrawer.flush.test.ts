import { describe, it, expect, vi } from 'vitest';
import { flushTemplateTasks } from './templateTasksFlush';

describe('flushTemplateTasks', () => {
  it('posts each task with challenge_id, title, template: true and reports 0 failures', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });

    const result = await flushTemplateTasks(
      'challenge-1',
      [{ title: 'Set up repo' }, { title: 'Write tests' }],
      fetchImpl as unknown as typeof fetch
    );

    expect(result).toEqual({ failed: 0 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl).toHaveBeenNthCalledWith(1, '/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challenge_id: 'challenge-1', title: 'Set up repo', template: true }),
    });
    expect(fetchImpl).toHaveBeenNthCalledWith(2, '/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challenge_id: 'challenge-1', title: 'Write tests', template: true }),
    });
  });

  it('counts a non-ok response as a failure but keeps flushing the rest', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true });

    const result = await flushTemplateTasks(
      'challenge-1',
      [{ title: 'Fails' }, { title: 'Succeeds' }],
      fetchImpl as unknown as typeof fetch
    );

    expect(result).toEqual({ failed: 1 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('counts a rejected fetch (network error) as a failure and keeps flushing the rest', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce({ ok: true });

    const result = await flushTemplateTasks(
      'challenge-1',
      [{ title: 'Throws' }, { title: 'Succeeds' }],
      fetchImpl as unknown as typeof fetch
    );

    expect(result).toEqual({ failed: 1 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('reports every task failed when everything rejects', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false });

    const result = await flushTemplateTasks(
      'challenge-1',
      [{ title: 'A' }, { title: 'B' }, { title: 'C' }],
      fetchImpl as unknown as typeof fetch
    );

    expect(result).toEqual({ failed: 3 });
  });

  it('resolves immediately with 0 failures for an empty task list', async () => {
    const fetchImpl = vi.fn();

    const result = await flushTemplateTasks('challenge-1', [], fetchImpl as unknown as typeof fetch);

    expect(result).toEqual({ failed: 0 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
