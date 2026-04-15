import { NextRequest, NextResponse } from 'next/server';
import { SyncMeetingService } from '../../../../../../../packages/services/sync-meeting/sync-meeting.service.js';
import { verifyRequestToken, verifyAdmin } from '@/lib/auth';

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
    const syncMeetingService = new SyncMeetingService();
    const meeting = await syncMeetingService.getMeetingById(id);

    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    return NextResponse.json({ meeting });
  } catch (error) {
    console.error('[SyncMeetings] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch meeting' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await verifyAdmin(request);
    if (!payload) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const syncMeetingService = new SyncMeetingService();
    await syncMeetingService.cancelMeeting(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[SyncMeetings] DELETE error:', error);
    return NextResponse.json({ error: 'Failed to cancel meeting' }, { status: 500 });
  }
}
