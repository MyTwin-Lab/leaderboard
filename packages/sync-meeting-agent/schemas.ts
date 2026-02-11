import { z } from 'zod';

export const DecisionSchema = z.object({
  description: z.string(),
  context: z.string().optional(),
  mentioned_by: z.array(z.string()).optional(),
});

export const ActionSchema = z.object({
  description: z.string(),
  assignee: z.string().optional(),
  deadline: z.string().optional(),
  priority: z.enum(['high', 'medium', 'low']).optional(),
});

export const ContributionSignalSchema = z.object({
  display_name: z.string(),
  signal_type: z.enum(['coordination', 'technical_leadership', 'problem_solving', 'knowledge_sharing']),
  weight: z.number().min(0).max(1),
  description: z.string().optional(),
});

export const MeetingAnalysisResultSchema = z.object({
  summary: z.string(),
  decisions: z.array(DecisionSchema),
  actions: z.array(ActionSchema),
  contribution_signals: z.array(ContributionSignalSchema),
});
