import { z } from "zod";

export const leaderboardQuerySchema = z.object({
  projectId: z.union([z.string().uuid(), z.literal("all"), z.undefined()]).default("all"),
  timePeriod: z.enum(["all", "month", "week"]).optional().default("all"),
});

export const contributorsQuerySchema = z.object({
  q: z.string().trim().optional(),
  projectId: z.string().uuid().optional(),
});

export const contributorParamSchema = z.object({
  userId: z.string().uuid(),
});

export type LeaderboardQueryParams = z.infer<typeof leaderboardQuerySchema>;
export type ContributorsQueryParams = z.infer<typeof contributorsQuerySchema>;
export type ContributorParam = z.infer<typeof contributorParamSchema>;

export function parseSearchParams<T extends z.ZodTypeAny>(
  schema: T,
  searchParams: URLSearchParams
): z.infer<T> {
  const entries = Object.fromEntries(searchParams.entries());
  return schema.parse(entries);
}
