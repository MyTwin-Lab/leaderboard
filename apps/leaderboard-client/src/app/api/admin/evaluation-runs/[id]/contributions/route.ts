import { NextRequest, NextResponse } from 'next/server';
import { EvaluationRunContributionsRepository } from '../../../../../../../../../packages/database-service/repositories/index';
import type { EvaluationRunContributionStatus } from '../../../../../../../../../packages/database-service/domain/entities';

const runContributionsRepo = new EvaluationRunContributionsRepository();

// GET /api/admin/evaluation-runs/[id]/contributions - Contributions d'un run
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: runId } = await params;
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const statusParam = searchParams.get('status');
    const status = statusParam 
      ? statusParam.split(',') as EvaluationRunContributionStatus[]
      : undefined;
    const page = parseInt(searchParams.get('page') ?? '1', 10);
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') ?? '50', 10), 100);

    // Récupérer les contributions avec les détails (contribution, user)
    const contributions = await runContributionsRepo.findByRunWithDetails(runId, {
      status,
      page,
      pageSize,
    });

    // Récupérer les stats par statut
    const statusCounts = await runContributionsRepo.countByStatus(runId);

    return NextResponse.json({
      contributions,
      pagination: {
        page,
        pageSize,
        total: contributions.length,
      },
      summary: {
        statusCounts,
      },
    });
  } catch (error) {
    console.error('Error fetching run contributions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch run contributions' },
      { status: 500 }
    );
  }
}
