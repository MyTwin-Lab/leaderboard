import { SyncMeetingRepository } from '../../database-service/repositories/index.js';
import { GoogleMeetService } from '../google-workspace/google-meet.service.js';

export class MeetingPollingService {
  private meetService: GoogleMeetService;

  constructor() {
    this.meetService = new GoogleMeetService();
  }

  async checkMeetingStatus(meetingCode: string) {
    const record = await this.meetService.getConferenceRecordFromMeetingCode(meetingCode);
    
    if (!record) {
      return { exists: false, record: null };
    }

    return { exists: true, record };
  }

  async getTranscripts(conferenceRecordName: string) {
    return await this.meetService.getTranscripts(conferenceRecordName);
  }

  async getParticipants(conferenceRecordName: string) {
    return await this.meetService.getParticipants(conferenceRecordName);
  }
}
