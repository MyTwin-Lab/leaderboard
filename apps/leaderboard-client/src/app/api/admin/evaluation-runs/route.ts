import { NextRequest, NextResponse } from 'next/server';
import { EvaluationRunsRepository } from '../../../../../../../packages/database-service/repositories/index';
import type { EvaluationRunStatus } from '../../../../../../../packages/database-service/domain/entities';

const runsRepo = new EvaluationRunsRepository();

// GET /api/admin/evaluation-runs - Liste des runs d'évaluation
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const challengeId = searchParams.get('challengeId') ?? undefined;
    const statusParam = searchParams.get('status');
    const status = statusParam 
      ? statusParam.split(',') as EvaluationRunStatus[]
      : undefined;
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');
    const from = fromParam ? new Date(fromParam) : undefined;
    const to = toParam ? new Date(toParam) : undefined;
    const page = parseInt(searchParams.get('page') ?? '1', 10);
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') ?? '20', 10), 100);

    const runs = await runsRepo.findAll({
      challengeId,
      status,
      from,
      to,
      page,
      pageSize,
    });

    // Get counts by status for summary
    const statusCounts = await runsRepo.countByStatus(challengeId);

    return NextResponse.json({
      runs,
      pagination: {
        page,
        pageSize,
        total: runs.length, // Note: pour une vraie pagination, il faudrait un count total
      },
      summary: {
        statusCounts,
      },
    });
  } catch (error) {
    console.error('Error fetching evaluation runs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch evaluation runs' },
      { status: 500 }
    );
  }
}
