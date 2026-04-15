import { NextRequest, NextResponse } from 'next/server';
import { EvaluationGridService } from '../../../../../../../packages/services/evaluation-grid.service';
import type { EvaluationGridStatus } from '../../../../../../../packages/database-service/domain/entities';

const gridService = new EvaluationGridService();

// GET /api/admin/evaluation-grids - Liste des grilles
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const statusParam = searchParams.get('status');
    const status = statusParam 
      ? statusParam.split(',') as EvaluationGridStatus[]
      : undefined;
    const search = searchParams.get('search') ?? undefined;
    const page = parseInt(searchParams.get('page') ?? '1', 10);
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') ?? '20', 10), 100);

    const grids = await gridService.listGrids({
      status,
      search,
      page,
      pageSize,
    });

    return NextResponse.json({
      grids,
      pagination: {
        page,
        pageSize,
        total: grids.length,
      },
    });
  } catch (error) {
    console.error('Error fetching evaluation grids:', error);
    return NextResponse.json(
      { error: 'Failed to fetch evaluation grids' },
      { status: 500 }
    );
  }
}

// POST /api/admin/evaluation-grids - Créer une nouvelle grille
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (!body.slug || !body.name) {
      return NextResponse.json(
        { error: 'slug and name are required' },
        { status: 400 }
      );
    }

    const grid = await gridService.createGrid({
      slug: body.slug,
      name: body.name,
      description: body.description,
      instructions: body.instructions,
      created_by: body.created_by,
    });

    return NextResponse.json(grid, { status: 201 });
  } catch (error) {
    console.error('Error creating evaluation grid:', error);
    const message = error instanceof Error ? error.message : 'Failed to create evaluation grid';
    return NextResponse.json(
      { error: message },
      { status: 400 }
    );
  }
}
