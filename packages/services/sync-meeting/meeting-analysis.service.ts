import {
  SyncMeetingRepository,
  MeetingParticipantRepository,
  MeetingAnalysisRepository,
  ChallengeRepository,
} from '../../database-service/repositories/index.js';
import { OpenAIMeetingAnalyzer } from '../../sync-meeting-agent/index.js';
import type { MeetingAnalysisContext, MeetingParticipantWithUtterances, Utterance } from '../../sync-meeting-agent/types.js';

export class MeetingAnalysisService {
  private syncMeetingRepo: SyncMeetingRepository;
  private participantRepo: MeetingParticipantRepository;
  private analysisRepo: MeetingAnalysisRepository;
  private challengeRepo: ChallengeRepository;
  private analyzer: OpenAIMeetingAnalyzer;

  constructor() {
    this.syncMeetingRepo = new SyncMeetingRepository();
    this.participantRepo = new MeetingParticipantRepository();
    this.analysisRepo = new MeetingAnalysisRepository();
    this.challengeRepo = new ChallengeRepository();
    this.analyzer = new OpenAIMeetingAnalyzer();
  }

  async analyze(meetingId: string, utterancesByParticipantId: Map<string, Utterance[]>) {
    console.log(`[MeetingAnalysis] Starting analysis for meeting ${meetingId}`);

    const meeting = await this.syncMeetingRepo.findById(meetingId);
    if (!meeting) {
      throw new Error('Meeting not found');
    }

    const challenge = await this.challengeRepo.findById(meeting.challenge_id);
    const participants = await this.participantRepo.findByMeetingId(meetingId);

    const participantsWithUtterances: MeetingParticipantWithUtterances[] = participants.map(p => ({
      user_id: p.user_id,
      google_user_id: p.google_user_id,
      display_name: p.display_name,
      utterances: utterancesByParticipantId.get(p.uuid) ?? [],
    }));

    const durationMinutes = Math.round(
      (meeting.end_time.getTime() - meeting.start_time.getTime()) / (1000 * 60)
    );

    const context: MeetingAnalysisContext = {
      meeting_id: meetingId,
      meeting_title: meeting.title,
      challenge_id: meeting.challenge_id,
      challenge_title: challenge?.title,
      challenge_roadmap: challenge?.roadmap,
      participants: participantsWithUtterances,
      duration_minutes: durationMinutes,
    };

    try {
      await this.analysisRepo.create({
        sync_meeting_id: meetingId,
        status: 'processing',
      });

      const result = await this.analyzer.analyze(context);

      const analysis = await this.analysisRepo.findByMeetingId(meetingId);
      if (analysis) {
        await this.analysisRepo.update(analysis.uuid, {
          summary: result.summary,
          decisions: result.decisions as any,
          actions: result.actions as any,
          contribution_signals: result.contribution_signals as any,
          status: 'completed',
          processed_at: new Date(),
        });
      }

      console.log(`[MeetingAnalysis] Analysis completed for meeting ${meetingId}`);
    } catch (error) {
      console.error(`[MeetingAnalysis] Error analyzing meeting ${meetingId}:`, error);

      const analysis = await this.analysisRepo.findByMeetingId(meetingId);
      if (analysis) {
        await this.analysisRepo.update(analysis.uuid, {
          status: 'failed',
          error_message: error instanceof Error ? error.message : String(error),
        });
      }

      throw error;
    }
  }
}
