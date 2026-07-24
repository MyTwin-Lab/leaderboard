import { NextRequest, NextResponse } from 'next/server';
import { runSlackSignalsCron } from '../../../../../../../packages/services/slack/cron-slack-signals.js';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const summaries = await runSlackSignalsCron();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      summaries,
    });
  } catch (error) {
    console.error('[Cron] Error in slack-signals:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
