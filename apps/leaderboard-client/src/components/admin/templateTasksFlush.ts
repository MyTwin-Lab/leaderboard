/**
 * POSTs each buffered template task to /api/tasks, sequentially, once the
 * challenge that owns them exists. Never throws: a task failure doesn't
 * undo the challenge that already saved, so the caller only needs a count
 * to decide what to tell the admin.
 *
 * Kept in its own module (no React, no `@/...` imports) so it can be unit
 * tested directly without pulling in CreateChallengeDrawer's full import
 * chain — and given an injectable `fetchImpl` so no DOM is needed either.
 */
export async function flushTemplateTasks(
  challengeId: string,
  tasks: { title: string }[],
  fetchImpl: typeof fetch = fetch
): Promise<{ failed: number }> {
  let failed = 0;
  for (const task of tasks) {
    try {
      const res = await fetchImpl('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challenge_id: challengeId,
          title: task.title,
          template: true,
        }),
      });
      if (!res.ok) failed++;
    } catch {
      failed++;
    }
  }
  return { failed };
}
