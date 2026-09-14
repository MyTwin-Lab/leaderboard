import { NextRequest, NextResponse } from 'next/server';
import { EvaluationRunsRepository } from '../../../../../../packages/database-service/repositories';
import { verifyRequestToken } from '@/lib/auth';

const runsRepo = new EvaluationRunsRepository();

// Helper partagé : une signature valide ne suffit pas (voir lib/sessionClaims.ts).
async function getSession(request: NextRequest): Promise<{ userId: string; role: string } | null> {
  const payload = await verifyRequestToken(request);
  return payload ? { userId: payload.userId, role: payload.role } : null;
}

// GET /api/evaluation-runs?challengeId=&status=&page=
export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (session.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const challengeId = searchParams.get('challengeId') ?? undefined;
    const statusParam = searchParams.get('status');
    const page = parseInt(searchParams.get('page') ?? '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') ?? '50', 10);

    const status = statusParam
      ? (statusParam.split(',') as any[])
      : undefined;

    const runs = await runsRepo.findAll({ challengeId, status, page, pageSize });
    return NextResponse.json(runs);
  } catch (error) {
    console.error('Error fetching evaluation runs:', error);
    return NextResponse.json({ error: 'Failed to fetch evaluation runs' }, { status: 500 });
  }
}
