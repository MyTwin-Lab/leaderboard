import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import { config } from '../../config/index.js';

export class GoogleMeetService {
  private meet;

  constructor() {
    const serviceAccountKey = config.googleWorkspace.serviceAccountKey;
    const adminEmail = config.googleWorkspace.adminEmail;

    if (!serviceAccountKey || !adminEmail) {
      throw new Error('Google Workspace service account not configured');
    }

    const credentials = JSON.parse(serviceAccountKey);

    const jwtClient = new JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ['https://www.googleapis.com/auth/meetings.space.readonly'],
      subject: adminEmail,
    });

    this.meet = google.meet({ version: 'v2', auth: jwtClient });
  }

  async getConferenceRecordFromMeetingCode(meetingCode: string) {
    try {
      const response = await this.meet.conferenceRecords.list({
        filter: `space.meeting_code = "${meetingCode}"`,
        pageSize: 1,
      });
      
      const records = response.data.conferenceRecords || [];
      return records.length > 0 ? records[0] : null;
    } catch (error: any) {
      if (error.code === 404) {
        return null;
      }
      throw error;
    }
  }

  async getConferenceRecord(conferenceId: string) {
    try {
      const response = await this.meet.conferenceRecords.get({
        name: `conferenceRecords/${conferenceId}`,
      });
      return response.data;
    } catch (error: any) {
      if (error.code === 404) {
        return null;
      }
      throw error;
    }
  }

  async getParticipants(conferenceRecordName: string) {
    const response = await this.meet.conferenceRecords.participants.list({
      parent: conferenceRecordName,
    });
    return response.data.participants || [];
  }

  async getTranscripts(conferenceRecordName: string) {
    const transcriptsResponse = await this.meet.conferenceRecords.transcripts.list({
      parent: conferenceRecordName,
    });

    const transcripts = transcriptsResponse.data.transcripts || [];
    const allEntries: any[] = [];

    for (const transcript of transcripts) {
      const entriesResponse = await this.meet.conferenceRecords.transcripts.entries.list({
        parent: transcript.name!,
      });
      const entries = (entriesResponse.data as any).transcriptEntries || [];
      allEntries.push(...entries);
    }

    return allEntries;
  }
}
