// domain/schemas.ts
import { z } from "zod";

export const projectSchema = z.object({
  uuid: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
  created_at: z.coerce.date(),
});

export const repoSchema = z.object({
  uuid: z.string().uuid(),
  title: z.string(),
  type: z.string(),
  external_repo_id: z.string().optional(),
  project_id: z.string().uuid(),
});

export const challengeRepoSchema = z.object({
  challenge_id: z.string().uuid(),
  repo_id: z.string().uuid(),
});

export const challengeTeamSchema = z.object({
  challenge_id: z.string().uuid(),
  user_id: z.string().uuid(),
});

export const challengeSchema = z.object({
  uuid: z.string().uuid(),
  index: z.number().int(),
  title: z.string(),
  status: z.string(),
  start_date: z.coerce.date(),
  end_date: z.coerce.date(),
  description: z.string().optional(),
  roadmap: z.string().optional(),
  contribution_points_reward: z.number().int().nonnegative(),
  project_id: z.string().uuid(),
});

export const contributionSchema = z.object({
  uuid: z.string().uuid(),
  title: z.string(),
  type: z.string(),
  description: z.string().optional(),
  evaluation: z.record(z.string(), z.any()).optional(),
  tags: z.array(z.string()).optional(),
  reward: z.number().default(0),
  user_id: z.string().uuid(),
  challenge_id: z.string().uuid(),
});

export const userSchema = z.object({
  uuid: z.string().uuid(),
  role: z.string(),
  full_name: z.string(),
  github_username: z.string(),
  created_at: z.coerce.date(),
});
