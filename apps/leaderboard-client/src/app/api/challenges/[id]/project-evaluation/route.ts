import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

async function getSession(request: NextRequest) {
  const token = request.cookies.get('access_token')?.value;
  if (!token) return null;
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    return { userId: payload.userId as string, role: payload.role as string };
  } catch { return null; }
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
    if (!check.ok) {
      const status = check.reason === 'already_running' ? 409 : 400;
      return NextResponse.json({ error: 'Cannot start evaluation', reason: check.reason }, { status });
    }

    service.scheduleEvaluation({ challengeId, userId: session.userId });
    return NextResponse.json({ scheduled: true }, { status: 202 });
  } catch (error) {
    console.error('Error starting project evaluation:', error);
    return NextResponse.json({ error: 'Failed to start evaluation' }, { status: 500 });
  }
}
