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

// Pas de poids ni de signal par participant : la SPEC du challenge 008 (§9)
// exclut toute utilisation à des fins d'évaluation individuelle. Un
// `contribution_signals` renvoyé malgré tout par le modèle est retiré par
// `parse` (clés inconnues ignorées).
export const MeetingAnalysisResultSchema = z.object({
  summary: z.string(),
  decisions: z.array(DecisionSchema),
  actions: z.array(ActionSchema),
});
