import { NextRequest, NextResponse } from 'next/server';
import { EvaluationRunsRepository } from '../../../../../../../../packages/database-service/repositories';
import { retryEvaluationRun } from '../../../../../../../../packages/capabilities/evaluation';
import { verifyRequestToken } from '@/lib/auth';

const runsRepo = new EvaluationRunsRepository();

// Helper partagé : une signature valide ne suffit pas (voir lib/sessionClaims.ts).
async function getSession(request: NextRequest): Promise<{ userId: string; role: string } | null> {
  const payload = await verifyRequestToken(request);
  return payload ? { userId: payload.userId, role: payload.role } : null;
}

const REFUSALS: Record<string, string> = {
  not_failed: 'Only a failed evaluation run can be retried',
  no_handler: 'No installed flow or module can replay this evaluation run',
  already_running: 'An evaluation is already running for this subject',
};

// POST /api/evaluation-runs/[id]/retry
//
// Rappelle le handler que le flow, l'extension ou le module propriétaire du
// run déclare, avec le payload inscrit dans le run. L'évaluation repart en
// tâche de fond : un nouveau run apparaît à côté de celui-ci.
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

    const outcome = await retryEvaluationRun(result.run);
    if (!outcome.ok) {
      return NextResponse.json(
        { error: REFUSALS[outcome.reason] ?? `This evaluation run cannot be retried (${outcome.reason})`, reason: outcome.reason },
        { status: 409 }
      );
    }

    return NextResponse.json({ retried: true }, { status: 202 });
  } catch (error) {
    console.error('Error retrying evaluation run:', error);
    return NextResponse.json({ error: 'Failed to retry evaluation run' }, { status: 500 });
  }
}
