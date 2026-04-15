import { SyncMeetingRepository } from '../../database-service/repositories/index.js';
import { MeetingPollingService } from './meeting-polling.service.js';
import { MeetingIngestionService } from './meeting-ingestion.service.js';

export async function checkCompletedMeetings() {
  const syncMeetingRepo = new SyncMeetingRepository();
  const pollingService = new MeetingPollingService();
  const ingestionService = new MeetingIngestionService();

  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const meetings = await syncMeetingRepo.findCompletedBefore(twentyFourHoursAgo, ['scheduled', 'in_progress']);

  console.log(`[Cron] Checking ${meetings.length} potentially completed meetings`);

  for (const meeting of meetings) {
    if (!meeting.conference_id) {
      console.warn(`[Cron] Meeting ${meeting.uuid} has no conference_id, skipping`);
      continue;
    }

    try {
      const status = await pollingService.checkMeetingStatus(meeting.conference_id);

      if (status.exists && status.record && status.record.name) {
        console.log(`[Cron] Meeting ${meeting.uuid} completed, starting ingestion`);

        await syncMeetingRepo.update(meeting.uuid, {
          status: 'completed',
          conference_record_id: status.record.name || undefined,
        });

        ingestionService.ingest(meeting.uuid).catch(error => {
          console.error(`[Cron] Ingestion failed for meeting ${meeting.uuid}:`, error);
        });
      }
    } catch (error) {
      console.error(`[Cron] Error checking meeting ${meeting.uuid}:`, error);
    }
  }
}
