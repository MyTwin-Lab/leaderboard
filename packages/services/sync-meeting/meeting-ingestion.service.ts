import { GoogleMeetService } from '../google-workspace/google-meet.service.js';
import {
  SyncMeetingRepository,
  MeetingParticipantRepository,
  GoogleAccountRepository,
} from '../../database-service/repositories/index.js';
import { MeetingPollingService } from './meeting-polling.service.js';
import { MeetingAnalysisService } from './meeting-analysis.service.js';
import type { Utterance } from '../../sync-meeting-agent/types.js';

export class MeetingIngestionService {
  private syncMeetingRepo: SyncMeetingRepository;
  private participantRepo: MeetingParticipantRepository;
  private googleAccountRepo: GoogleAccountRepository;
  private pollingService: MeetingPollingService;
  private analysisService: MeetingAnalysisService;

  constructor() {
    this.syncMeetingRepo = new SyncMeetingRepository();
    this.participantRepo = new MeetingParticipantRepository();
    this.googleAccountRepo = new GoogleAccountRepository();
    this.pollingService = new MeetingPollingService();
    this.analysisService = new MeetingAnalysisService();
  }

  async ingest(meetingId: string) {
    console.log(`[MeetingIngestion] Starting ingestion for meeting ${meetingId}`);

    const meeting = await this.syncMeetingRepo.findById(meetingId);
    if (!meeting) {
      throw new Error('Meeting not found');
    }

    if (!meeting.conference_record_id) {
      throw new Error('Meeting has no conference record ID');
    }

    try {
      const participants = await this.pollingService.getParticipants(meeting.conference_record_id);
      console.log(`[MeetingIngestion] Found ${participants.length} participants`);

      const participantMap = new Map<string, string>();

      for (const p of participants) {
        const googleUserId = (p.signedinUser as any)?.user?.split('/').pop();
        if (!googleUserId) continue;

        const googleAccount = await this.googleAccountRepo.findByGoogleUserId(googleUserId);

        const participant = await this.participantRepo.create({
          sync_meeting_id: meetingId,
          user_id: googleAccount?.user_id,
          google_user_id: googleUserId,
          display_name: (p.signedinUser as any)?.displayName || 'Unknown',
        });

        participantMap.set(googleUserId, participant.uuid);
      }

      const transcriptEntries = await this.pollingService.getTranscripts(meeting.conference_record_id);
      console.log(`[MeetingIngestion] Found ${transcriptEntries.length} transcript entries`);

      const utterancesByParticipantId = new Map<string, Utterance[]>();

      for (const entry of transcriptEntries) {
        const participantId = (entry.participant as any)?.split('/').pop();
        const googleUserId = participants.find(p => p.name?.includes(participantId))?.signedinUser;
        const googleUserIdClean = (googleUserId as any)?.user?.split('/').pop();

        if (!googleUserIdClean || !participantMap.has(googleUserIdClean)) {
          continue;
        }

        const mappedParticipantId = participantMap.get(googleUserIdClean)!;
        const utterance: Utterance = {
          text: entry.text || '',
          start_time: new Date(entry.startTime!),
          end_time: entry.endTime ? new Date(entry.endTime) : undefined,
        };

        const existing = utterancesByParticipantId.get(mappedParticipantId) ?? [];
        existing.push(utterance);
        utterancesByParticipantId.set(mappedParticipantId, existing);
      }

      console.log(`[MeetingIngestion] Ingestion completed, triggering analysis`);

      await this.analysisService.analyze(meetingId, utterancesByParticipantId);

      await this.syncMeetingRepo.update(meetingId, { status: 'processed' });

      console.log(`[MeetingIngestion] Meeting ${meetingId} fully processed`);
    } catch (error) {
      console.error(`[MeetingIngestion] Error ingesting meeting ${meetingId}:`, error);
      throw error;
    }
  }
}
