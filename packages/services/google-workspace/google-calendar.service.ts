import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import { config } from '../../config/index.js';

export class GoogleCalendarService {
  private calendar;

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
      scopes: [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events',
      ],
      subject: adminEmail,
    });

    this.calendar = google.calendar({ version: 'v3', auth: jwtClient });
  }

  async createMeetingEvent(params: {
    title: string;
    description?: string;
    startTime: Date;
    endTime: Date;
    attendees: string[];
  }) {
    const event = await this.calendar.events.insert({
      calendarId: 'primary',
      conferenceDataVersion: 1,
      requestBody: {
        summary: params.title,
        description: params.description,
        start: {
          dateTime: params.startTime.toISOString(),
          timeZone: 'UTC',
        },
        end: {
          dateTime: params.endTime.toISOString(),
          timeZone: 'UTC',
        },
        attendees: params.attendees.map(email => ({ email })),
        conferenceData: {
          createRequest: {
            requestId: `meeting-${Date.now()}`,
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        },
      },
    });

    return {
      calendar_event_id: event.data.id!,
      meet_link: event.data.hangoutLink!,
      conference_id: event.data.conferenceData?.conferenceId,
    };
  }

  async deleteEvent(calendarEventId: string) {
    await this.calendar.events.delete({
      calendarId: 'primary',
      eventId: calendarEventId,
    });
  }
}
