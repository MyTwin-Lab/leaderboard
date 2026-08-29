/**
 * Share of a contributor's board that is done, as a whole percent.
 *
 * Clamped rather than trusted: `done` and `total` are counted from a task list
 * that can be stale mid-refresh, and a bar wider than its track is a visible
 * glitch. An empty board is 0%, not NaN.
 */
export function completionPercent(done: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((done / total) * 100)));
}
