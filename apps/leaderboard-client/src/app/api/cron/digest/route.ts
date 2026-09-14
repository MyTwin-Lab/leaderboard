import { NextRequest, NextResponse } from 'next/server';
import { runDigestCron } from '../../../../../../../packages/services/digest/cron-digest.js';
import { isCronAuthorized } from '@/lib/server/cronAuth';
import { runRetentionPurges } from './retention';

export async function GET(request: NextRequest) {
  try {
    if (!isCronAuthorized(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Les purges passent avant le digest : `runDigestCron` s'arrête tôt quand
    // le digest est désactivé ou pas dû, et une erreur de génération ne doit
    // pas repousser d'un jour une purge promise par la politique de
    // confidentialité. Chaque purge absorbe ses propres erreurs.
    const retention = await runRetentionPurges();

    const result = await runDigestCron();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result,
      retention,
    });
  } catch (error) {
    console.error('[Cron] Error in digest:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
