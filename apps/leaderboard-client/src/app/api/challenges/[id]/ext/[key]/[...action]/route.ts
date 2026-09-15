import type { NextRequest } from 'next/server';
import { dispatchChallengeAction } from '../../../../../../../../../../packages/capabilities/challenge-actions';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string; key: string; action: string[] }> };

// /api/challenges/[id]/ext/<extension>/<action> — les actions d'une extension
// attachée au flow du challenge. Même dispatcher que les actions de flow.
async function handle(request: NextRequest, { params }: Params) {
  const { id, key, action } = await params;
  const session = await getSessionUser();
  return dispatchChallengeAction({
    request,
    challengeId: id,
    scope: { kind: 'extension', key },
    segments: action,
    user: session ? { id: session.id, role: session.role } : null,
  });
}

export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE };
