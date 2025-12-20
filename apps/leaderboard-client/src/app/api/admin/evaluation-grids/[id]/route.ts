import { NextRequest, NextResponse } from 'next/server';
import { EvaluationGridService } from '../../../../../../../../packages/services/evaluation-grid.service';

const gridService = new EvaluationGridService();

// GET /api/admin/evaluation-grids/[id] - Détail d'une grille
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const grid = await gridService.getFullGrid(id);
    
    if (!grid) {
      return NextResponse.json(
        { error: 'Evaluation grid not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(grid);
  } catch (error) {
    console.error('Error fetching evaluation grid:', error);
    return NextResponse.json(
      { error: 'Failed to fetch evaluation grid' },
      { status: 500 }
    );
  }
}

// PUT /api/admin/evaluation-grids/[id] - Mettre à jour une grille
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const grid = await gridService.updateGrid(id, {
      name: body.name,
      description: body.description,
      instructions: body.instructions,
    });

    if (!grid) {
      return NextResponse.json(
        { error: 'Evaluation grid not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(grid);
  } catch (error) {
    console.error('Error updating evaluation grid:', error);
    const message = error instanceof Error ? error.message : 'Failed to update';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// DELETE /api/admin/evaluation-grids/[id] - Supprimer une grille
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await gridService.deleteGrid(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting evaluation grid:', error);
    const message = error instanceof Error ? error.message : 'Failed to delete';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
