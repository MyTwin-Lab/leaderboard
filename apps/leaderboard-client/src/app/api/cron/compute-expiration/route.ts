import { NextRequest, NextResponse } from 'next/server';
import { expireComputeInstances } from '../../../../../../../packages/services/compute/cron-expire-instances.js';
import { isCronAuthorized } from '@/lib/server/cronAuth';

export async function GET(request: NextRequest) {
  try {
    if (!isCronAuthorized(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await expireComputeInstances();

    return NextResponse.json({ success: true, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('[Cron] Error in compute-expiration:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
