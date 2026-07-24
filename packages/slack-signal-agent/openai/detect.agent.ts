import OpenAI from 'openai';
import { getOpenAIApiKey } from '../../config/openaiCredentials.js';
import { SlackSignalContext, SlackSignalDetectionResult } from '../types.js';
import { buildDetectionPrompt } from '../prompts.js';
import { SlackSignalDetectionResultSchema } from '../schemas.js';

export async function runDetectAgent(context: SlackSignalContext): Promise<SlackSignalDetectionResult> {
  const apiKey = await getOpenAIApiKey();
  if (!apiKey) {
    throw new Error('OpenAI API key is not configured (connect it in Integrations or set OPENAI_API_KEY)');
  }

  const openai = new OpenAI({ apiKey });

  const prompt = buildDetectionPrompt(context);

  console.log('[SlackSignalAgent] Calling OpenAI API...');

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: 'You are an expert at analyzing team chat discussions and detecting predefined contribution signals. Always respond with valid JSON.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.3,
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from OpenAI');
  }

  console.log('[SlackSignalAgent] Parsing OpenAI response...');

  const parsed = JSON.parse(content);
  const validated = SlackSignalDetectionResultSchema.parse(parsed);

  // Garde-fous : on ne garde que les détections dont les identifiants existent
  // réellement dans le contexte envoyé (le LLM ne doit rien inventer).
  const signalIds = new Set(context.signals.map((s) => s.signal_id));
  const participantIds = new Set(context.participants.map((p) => p.user_id));
  const messageTs = new Set(context.messages.map((m) => m.ts));

  const detections = validated.detections.filter((d) => {
    if (!signalIds.has(d.signal_id)) return false;
    if (!participantIds.has(d.user_id)) return false;
    if (!messageTs.has(d.message_ts)) return false;
    return true;
  });

  const dropped = validated.detections.length - detections.length;
  if (dropped > 0) {
    console.warn(`[SlackSignalAgent] Dropped ${dropped} detection(s) with unknown signal/user/message identifiers`);
  }

  console.log(`[SlackSignalAgent] Detection completed: ${detections.length} signal(s)`);

  return { detections };
}
