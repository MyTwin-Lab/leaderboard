import { NextRequest, NextResponse } from 'next/server';
import { runDueJobs } from '../../../../../../../packages/capabilities/cron';
import { isCronAuthorized } from '@/lib/server/cronAuth';

export const dynamic = 'force-dynamic';

// GET /api/cron/tick — appelé chaque minute par le planificateur. Lance les
// jobs dus du core et de la distribution (installée par `instrumentation.ts`),
// un par un, chacun sous son verrou de `cron_runs`. Un job en échec n'arrête
// pas les suivants : il est journalisé et inscrit dans `cron_runs`.
export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const jobs = await runDueJobs();
    return NextResponse.json({
      success: jobs.every((job) => job.status !== 'failed'),
      timestamp: new Date().toISOString(),
      jobs,
    });
  } catch (error) {
    console.error('[Cron] Error in tick:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
