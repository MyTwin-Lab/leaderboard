import { cronJobRoute } from '@/lib/server/cronJobRoute';

export const dynamic = 'force-dynamic';

// Remplacée par /api/cron/tick ; conservée jusqu'au lot L7 du challenge 020.
export const GET = cronJobRoute('digest.generate');
