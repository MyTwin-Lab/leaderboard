import type { NextRequest } from 'next/server';
import { dispatchChallengeAction } from '../../../../../../../../../packages/capabilities/challenge-actions';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string; action: string[] }> };

// /api/challenges/[id]/flow/<action> — les actions du flow du challenge.
// Le dispatcher résout l'action et applique l'accès qu'elle déclare.
async function handle(request: NextRequest, { params }: Params) {
  const { id, action } = await params;
  const session = await getSessionUser();
  return dispatchChallengeAction({
    request,
    challengeId: id,
    scope: { kind: 'flow' },
    segments: action,
    user: session ? { id: session.id, role: session.role } : null,
  });
}

export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE };
