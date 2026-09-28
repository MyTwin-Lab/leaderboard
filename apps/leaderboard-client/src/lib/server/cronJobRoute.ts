import { NextRequest, NextResponse } from 'next/server';
import { runJobNow } from '../../../../../packages/capabilities/cron';
import { isCronAuthorized } from '@/lib/server/cronAuth';

/**
 * Une ancienne route `/api/cron/<nom>`, réduite à lancer son job du registre
 * sous le verrou de `cron_runs`. Conservées jusqu'au lot L7 du challenge 020,
 * le temps que le planificateur n'appelle plus que `/api/cron/tick` : si les
 * deux coexistent, le verrou empêche une double exécution.
 */
export function cronJobRoute(jobKey: string) {
  return async function GET(request: NextRequest) {
    if (!isCronAuthorized(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
      const run = await runJobNow(jobKey);
      if (run.status === 'failed') {
        return NextResponse.json({ success: false, error: run.error ?? 'Unknown error' }, { status: 500 });
      }
      return NextResponse.json({
        success: true,
        timestamp: new Date().toISOString(),
        // `busy` : le tick ou un autre appel tient déjà le job.
        status: run.status,
        result: run.result ?? null,
      });
    } catch (error) {
      console.error(`[Cron] Error in ${jobKey}:`, error);
      return NextResponse.json(
        { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
        { status: 500 }
      );
    }
  };
}
