import { NextRequest, NextResponse } from 'next/server';
import { EvaluationRunsRepository } from '../../../../../../../../packages/database-service/repositories';
import { verifyRequestToken } from '@/lib/auth';

const runsRepo = new EvaluationRunsRepository();

// Helper partagé : une signature valide ne suffit pas (voir lib/sessionClaims.ts).
async function getSession(request: NextRequest): Promise<{ userId: string; role: string } | null> {
  const payload = await verifyRequestToken(request);
  return payload ? { userId: payload.userId, role: payload.role } : null;
}

// POST /api/evaluation-runs/[id]/retry
//
// Le rejeu passait par le pipeline sync legacy, supprimé (challenge 020, lot L0).
// Il revient quand la capacité d'évaluation du core écrit les runs et sait
// rappeler le handler du flow qui les a lancés (lot L2). D'ici là, un run
// existant répond 409 plutôt que de relancer un pipeline qui n'existe plus.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (session.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    const result = await runsRepo.findWithChallenge(id);
    if (!result) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    return NextResponse.json({ error: 'This evaluation run cannot be retried' }, { status: 409 });
  } catch (error) {
    console.error('Error retrying evaluation run:', error);
    return NextResponse.json({ error: 'Failed to retry evaluation run' }, { status: 500 });
  }
}
