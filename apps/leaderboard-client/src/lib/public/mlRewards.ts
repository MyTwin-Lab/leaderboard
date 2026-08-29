/**
 * Reduces the ml-rewards payload to what an anonymous visitor may see.
 *
 * The route returns a per-user CP breakdown and the reward rules themselves.
 * The challenge page reads neither — mlRewardsQuery types its result as
 * `{ metric, bestValue }` — so nothing else goes out.
 */
export interface PublicMlRewards {
  metric: { name: string; baseline: number; points: number[] } | null;
  bestValue: number | null;
}

export function toPublicMlRewards(data: any): PublicMlRewards {
  return {
    metric: data?.metric ?? null,
    bestValue: data?.bestValue ?? null,
  };
}
