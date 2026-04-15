import { NextRequest, NextResponse } from 'next/server';
import { SyncMeetingService } from '../../../../../../packages/services/sync-meeting/sync-meeting.service.js';
import { verifyRequestToken, verifyAdmin } from '@/lib/auth';
import { z } from 'zod';

const createMeetingSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  challenge_id: z.string().uuid(),
  start_time: z.string().datetime(),
  end_time: z.string().datetime(),
});

export async function GET(request: NextRequest) {
  try {
    const payload = await verifyRequestToken(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const challengeId = searchParams.get('challenge_id');

    const syncMeetingService = new SyncMeetingService();

    if (challengeId) {
      const meetings = await syncMeetingService.getMeetingsByChallengeId(challengeId);
      return NextResponse.json({ meetings });
    }

    // Retourner tous les meetings si pas de challenge_id
    const allMeetings = await syncMeetingService.getAllMeetings();
    return NextResponse.json({ meetings: allMeetings });
  } catch (error) {
    console.error('[SyncMeetings] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch meetings' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await verifyAdmin(request);
    if (!payload) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    console.log('[SyncMeetings][POST] Raw body:', body);
    const parsed = createMeetingSchema.safeParse(body);
    if (!parsed.success) {
      console.error('[SyncMeetings][POST] Validation failed:', parsed.error.issues);
      return NextResponse.json(
        { error: 'Validation error', details: parsed.error.issues },
        { status: 400 }
      );
    }
    const validated = parsed.data;

    const syncMeetingService = new SyncMeetingService();
    const meeting = await syncMeetingService.createMeeting({
      title: validated.title,
      description: validated.description,
      challenge_id: validated.challenge_id,
      start_time: new Date(validated.start_time),
      end_time: new Date(validated.end_time),
      created_by: payload.userId,
    });

    return NextResponse.json({ meeting }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 400 });
    }
    console.error('[SyncMeetings] POST error:', error);
    return NextResponse.json({ error: 'Failed to create meeting' }, { status: 500 });
  }
}
