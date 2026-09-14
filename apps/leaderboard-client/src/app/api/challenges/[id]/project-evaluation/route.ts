import { NextRequest, NextResponse } from 'next/server';
import { verifyRequestToken } from '@/lib/auth';

// Helper partagé : une signature valide ne suffit pas (voir lib/sessionClaims.ts).
async function getSession(request: NextRequest) {
  const payload = await verifyRequestToken(request);
  return payload ? { userId: payload.userId, role: payload.role } : null;
}

function refusal(reason: string | undefined) {
  const status = reason === 'already_running' ? 409 : 400;
  return NextResponse.json({ error: 'Cannot start evaluation', reason }, { status });
}

// POST /api/challenges/[id]/project-evaluation
// Lance l'évaluation globale du board personnel du contributeur connecté.
// Fire-and-forget : le statut vit sur la contribution `project` (pollée par l'UI).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const { id: challengeId } = await params;

    const { CodeRewardsService } = await import(
      '../../../../../../../../packages/services/challenge/code-rewards.service'
    );
    const service = new CodeRewardsService();
    const check = await service.canEvaluate(challengeId, session.userId);
    if (!check.ok) return refusal(check.reason);

    // Le passage à `running` est un compare-and-set attendu ici, avant le
    // 202 : un second lancement concurrent reçoit 409 au lieu de planifier un
    // second run (et un second appel LLM).
    const event = { challengeId, userId: session.userId };
    const claim = await service.claim(event);
    if (!claim.ok) return refusal(claim.reason);

    service.scheduleRun(event);
    return NextResponse.json({ scheduled: true }, { status: 202 });
  } catch (error) {
    console.error('Error starting project evaluation:', error);
    return NextResponse.json({ error: 'Failed to start evaluation' }, { status: 500 });
  }
}
