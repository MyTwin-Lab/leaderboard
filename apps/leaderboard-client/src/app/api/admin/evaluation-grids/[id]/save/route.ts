import { NextRequest, NextResponse } from 'next/server';
import { EvaluationGridService } from '../../../../../../../../../packages/services/evaluation-grid.service';

const gridService = new EvaluationGridService();

// POST /api/admin/evaluation-grids/[id]/save - Sauvegarder une grille complète
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const grid = await gridService.saveFullGrid(id, {
      name: body.name,
      description: body.description,
      instructions: body.instructions,
      categories: body.categories || [],
    });

    if (!grid) {
      return NextResponse.json(
        { error: 'Evaluation grid not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      grid,
    });
  } catch (error) {
    console.error('Error saving evaluation grid:', error);
    const message = error instanceof Error ? error.message : 'Failed to save';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
