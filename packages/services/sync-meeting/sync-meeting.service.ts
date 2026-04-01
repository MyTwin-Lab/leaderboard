import { SyncMeetingRepository, ChallengeTeamRepository, UserRepository } from '../../database-service/repositories/index.js';
import { GoogleCalendarService } from '../google-workspace/google-calendar.service.js';

export class SyncMeetingService {
  private syncMeetingRepo: SyncMeetingRepository;
  private challengeTeamRepo: ChallengeTeamRepository;
  private userRepo: UserRepository;
  private calendarService: GoogleCalendarService;

  constructor() {
    this.syncMeetingRepo = new SyncMeetingRepository();
    this.challengeTeamRepo = new ChallengeTeamRepository();
    this.userRepo = new UserRepository();
    this.calendarService = new GoogleCalendarService();
  }

  async createMeeting(params: {
    title: string;
    description?: string;
    challenge_id: string;
    start_time: Date;
    end_time: Date;
    created_by: string;
  }) {
    const teamMembers = await this.challengeTeamRepo.findByChallenge(params.challenge_id);
    const userIds = teamMembers.map((tm: any) => tm.user_id);
    const users = await this.userRepo.findByIds(userIds);
    const attendeeEmails = users
      .map((user) => user.email)
      .filter((email): email is string => Boolean(email));

    const calendarEvent = await this.calendarService.createMeetingEvent({
      title: params.title,
      description: params.description,
      startTime: params.start_time,
      endTime: params.end_time,
      attendees: attendeeEmails,
    });

    const meeting = await this.syncMeetingRepo.create({
      title: params.title,
      description: params.description,
      challenge_id: params.challenge_id,
      start_time: params.start_time,
      end_time: params.end_time,
      meet_link: calendarEvent.meet_link,
      calendar_event_id: calendarEvent.calendar_event_id,
      conference_id: calendarEvent.conference_id || undefined,
      status: 'scheduled',
      created_by: params.created_by,
    });

    return meeting;
  }

  async getMeetingById(meetingId: string) {
    return await this.syncMeetingRepo.findById(meetingId);
  }

  async getMeetingsByChallengeId(challengeId: string) {
    return await this.syncMeetingRepo.findByChallengeId(challengeId);
  }

  async getAllMeetings() {
    return await this.syncMeetingRepo.findAll();
  }

  async updateMeeting(meetingId: string, data: { title?: string; description?: string; start_time?: Date; end_time?: Date }) {
    return await this.syncMeetingRepo.update(meetingId, data);
  }

  async cancelMeeting(meetingId: string) {
    const meeting = await this.syncMeetingRepo.findById(meetingId);
    if (!meeting) {
      throw new Error('Meeting not found');
    }

    if (meeting.calendar_event_id) {
      await this.calendarService.deleteEvent(meeting.calendar_event_id);
    }

    return await this.syncMeetingRepo.update(meetingId, { status: 'cancelled' });
  }
}
