import { z } from 'zod';

export const SlackSignalDetectionSchema = z.object({
  signal_id: z.string().uuid(),
  user_id: z.string().uuid(),
  message_ts: z.string(),
  justification: z.string(),
});

export const SlackSignalDetectionResultSchema = z.object({
  detections: z.array(SlackSignalDetectionSchema),
});
