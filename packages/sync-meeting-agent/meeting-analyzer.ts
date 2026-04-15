import { MeetingAnalyzer } from './interfaces.js';
import { MeetingAnalysisContext, MeetingAnalysisResult } from './types.js';
import { runAnalyzeAgent } from './openai/analyze.agent.js';

export class OpenAIMeetingAnalyzer implements MeetingAnalyzer {
  async analyze(context: MeetingAnalysisContext): Promise<MeetingAnalysisResult> {
    console.log(`[MeetingAnalyzer] Analyzing meeting: ${context.meeting_title}`);
    
    try {
      const result = await runAnalyzeAgent(context);
      return result;
    } catch (error) {
      console.error('[MeetingAnalyzer] Analysis failed:', error);
      throw new Error(`Meeting analysis failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
