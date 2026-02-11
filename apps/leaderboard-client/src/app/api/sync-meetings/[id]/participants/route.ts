import { NextRequest, NextResponse } from 'next/server';
import { MeetingParticipantRepository } from '../../../../../../../../packages/database-service/repositories/meetingParticipant.repo.js';
import { verifyRequestToken } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await verifyRequestToken(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const participantRepo = new MeetingParticipantRepository();
    const participants = await participantRepo.findByMeetingId(id);

    return NextResponse.json({ participants });
  } catch (error) {
    console.error('[MeetingParticipants] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch participants' }, { status: 500 });
  }
}
