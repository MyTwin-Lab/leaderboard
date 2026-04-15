import { NextRequest, NextResponse } from 'next/server';
import { EvaluationGridService } from '../../../../../../../../../packages/services/evaluation-grid.service';

const gridService = new EvaluationGridService();

// POST /api/admin/evaluation-grids/[id]/publish - Publier une grille
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const grid = await gridService.publishGrid(id);

    if (!grid) {
      return NextResponse.json(
        { error: 'Evaluation grid not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      grid,
      message: `Grid "${grid.name}" published as version ${grid.version}`,
    });
  } catch (error) {
    console.error('Error publishing evaluation grid:', error);
    const message = error instanceof Error ? error.message : 'Failed to publish';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
