import { NextRequest, NextResponse } from 'next/server';
import { EvaluationGridService } from '../../../../../../../../../packages/services/evaluation-grid.service';

const gridService = new EvaluationGridService();

// POST /api/admin/evaluation-grids/[id]/duplicate - Dupliquer une grille
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    let body: { newSlug?: string } = {};
    try {
      body = await request.json();
    } catch {
      // Body vide
    }

    const grid = await gridService.duplicateGrid(id, body.newSlug);

    if (!grid) {
      return NextResponse.json(
        { error: 'Evaluation grid not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      grid,
      message: `Grid duplicated as "${grid.slug}"`,
    }, { status: 201 });
  } catch (error) {
    console.error('Error duplicating evaluation grid:', error);
    const message = error instanceof Error ? error.message : 'Failed to duplicate';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
