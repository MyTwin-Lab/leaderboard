import { MeetingAnalysisContext, MeetingAnalysisResult } from './types.js';

export interface MeetingAnalyzer {
  analyze(context: MeetingAnalysisContext): Promise<MeetingAnalysisResult>;
}
