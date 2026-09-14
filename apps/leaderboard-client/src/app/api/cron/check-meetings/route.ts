import { NextRequest, NextResponse } from 'next/server';
import { checkCompletedMeetings } from '../../../../../../../packages/services/sync-meeting/cron-check-meetings.js';
import { isCronAuthorized } from '@/lib/server/cronAuth';

export async function GET(request: NextRequest) {
  try {
    if (!isCronAuthorized(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await checkCompletedMeetings();

    return NextResponse.json({ 
      success: true, 
      timestamp: new Date().toISOString() 
    });
  } catch (error) {
    console.error('[Cron] Error in check-meetings:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
