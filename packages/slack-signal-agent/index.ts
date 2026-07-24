export { runDetectAgent } from './openai/detect.agent.js';
export { buildDetectionPrompt } from './prompts.js';
export { SlackSignalDetectionResultSchema, SlackSignalDetectionSchema } from './schemas.js';
export type {
  SlackSignalContext,
  SlackSignalDefinition,
  SlackSignalParticipant,
  SlackSignalMessage,
  SlackSignalDetection,
  SlackSignalDetectionResult,
} from './types.js';
