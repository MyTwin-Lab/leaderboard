import { NextRequest, NextResponse } from 'next/server';
import { EvaluationRunsRepository } from '../../../../../../packages/database-service/repositories';

const runsRepo = new EvaluationRunsRepository();

// GET /api/evaluation-runs?challengeId=&status=&page=
export async function GET(request: NextRequest) {
  try {
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
