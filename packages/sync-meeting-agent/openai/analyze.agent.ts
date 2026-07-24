import OpenAI from 'openai';
import { getOpenAIApiKey } from '../../config/openaiCredentials.js';
import { MeetingAnalysisContext, MeetingAnalysisResult } from '../types.js';
import { buildAnalysisPrompt } from '../prompts.js';
import { MeetingAnalysisResultSchema } from '../schemas.js';

export async function runAnalyzeAgent(context: MeetingAnalysisContext): Promise<MeetingAnalysisResult> {
  const apiKey = await getOpenAIApiKey();
  if (!apiKey) {
    throw new Error('OpenAI API key is not configured (connect it in Integrations or set OPENAI_API_KEY)');
  }

  const openai = new OpenAI({ apiKey });

  const prompt = buildAnalysisPrompt(context);

  console.log('[MeetingAnalyzer] Calling OpenAI API...');

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: 'You are an expert meeting analyst. You analyze meeting transcripts and extract structured information. Always respond with valid JSON.',
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

  console.log('[MeetingAnalyzer] Parsing OpenAI response...');

  const parsed = JSON.parse(content);
  const validated = MeetingAnalysisResultSchema.parse(parsed);

  console.log('[MeetingAnalyzer] Analysis completed successfully');

  return validated;
}
