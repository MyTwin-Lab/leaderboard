import { NextRequest, NextResponse } from 'next/server';
import { MeetingParticipantRepository } from '../../../../../../../../packages/database-service/repositories/meetingParticipant.repo.js';
import { getSessionUser } from '@/lib/auth';
import { loadAccessibleMeeting, toParticipantView } from '../../meetingAccess';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const meeting = await loadAccessibleMeeting(id, user);
    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    const participantRepo = new MeetingParticipantRepository();
    const participants = await participantRepo.findByMeetingId(id);
    const isAdmin = user.role === 'admin';

    return NextResponse.json({ participants: participants.map(p => toParticipantView(p, isAdmin)) });
  } catch (error) {
    console.error('[MeetingParticipants] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch participants' }, { status: 500 });
  }
}
