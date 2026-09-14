import { NextRequest, NextResponse } from 'next/server';
import { SyncMeetingService } from '../../../../../../packages/services/sync-meeting/sync-meeting.service.js';
import { getSessionUser } from '@/lib/auth';
import { isManagerOfChallenge, canAccessChallengeInternals } from '@/lib/server/managerAuth';
import { toMeetingView } from './meetingAccess';
import { z } from 'zod';

const createMeetingSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  challenge_id: z.string().uuid(),
  start_time: z.string().datetime(),
  end_time: z.string().datetime(),
  meet_link: z.string().url().optional(),
});

export async function GET(request: NextRequest) {
  try {
    // Rôle relu en base : un rôle retiré ne survit pas jusqu'à l'expiration du JWT.
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const isAdmin = user.role === 'admin';

    const searchParams = request.nextUrl.searchParams;
    const challengeId = searchParams.get('challenge_id');

    if (challengeId) {
      if (!(await canAccessChallengeInternals(user, challengeId))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      const meetings = await new SyncMeetingService().getMeetingsByChallengeId(challengeId);
      return NextResponse.json({ meetings: isAdmin ? meetings : meetings.map(toMeetingView) });
    }

    // Tous les meetings, tous challenges confondus : vue admin uniquement.
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const allMeetings = await new SyncMeetingService().getAllMeetings();
    return NextResponse.json({ meetings: allMeetings });
  } catch (error) {
    console.error('[SyncMeetings] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch meetings' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Même raison que le GET : le rôle admin se relit en base.
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createMeetingSchema.safeParse(body);
    if (!parsed.success) {
      console.error('[SyncMeetings][POST] Validation failed:', parsed.error.issues);
      return NextResponse.json(
        { error: 'Validation error', details: parsed.error.issues },
        { status: 400 }
      );
    }
    const validated = parsed.data;

    const isAdmin = user.role === 'admin';
    const isManager = !isAdmin && await isManagerOfChallenge(user.id, validated.challenge_id);
    if (!isAdmin && !isManager) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const syncMeetingService = new SyncMeetingService();
    const meeting = await syncMeetingService.createMeeting({
      title: validated.title,
      description: validated.description,
      challenge_id: validated.challenge_id,
      start_time: new Date(validated.start_time),
      end_time: new Date(validated.end_time),
      created_by: user.id,
    });

    return NextResponse.json({ meeting }, { status: 201 });
  } catch (error) {
    console.error('[SyncMeetings] POST error:', error);
    return NextResponse.json({ error: 'Failed to create meeting' }, { status: 500 });
  }
}
