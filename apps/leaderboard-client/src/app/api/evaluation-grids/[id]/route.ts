import { NextRequest, NextResponse } from 'next/server';
import { EvaluationGridsRepository } from '../../../../../../../packages/database-service/repositories/evaluationGrids.repo.js';
import { verifyAdmin } from '@/lib/auth';
import { z } from 'zod';

const updateGridSchema = z.object({
  slug: z.string().min(1).max(64).optional(),
  name: z.string().min(1).max(120).optional(),
  description: z.string().optional(),
  version: z.number().int().positive().optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  instructions: z.string().optional(),
});

const gridRepo = new EvaluationGridsRepository();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await verifyAdmin(request);
    if (!payload) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const grid = await gridRepo.findFull(id);

    if (!grid) {
      return NextResponse.json({ error: 'Grid not found' }, { status: 404 });
    }

    return NextResponse.json(grid);
  } catch (error) {
    console.error('[EvaluationGrids] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch grid' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await verifyAdmin(request);
    if (!payload) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = updateGridSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const grid = await gridRepo.updateGrid(id, parsed.data);
    return NextResponse.json(grid);
  } catch (error) {
    console.error('[EvaluationGrids] PUT error:', error);
    return NextResponse.json({ error: 'Failed to update grid' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await verifyAdmin(request);
    if (!payload) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    await gridRepo.deleteGrid(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[EvaluationGrids] DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete grid' }, { status: 500 });
  }
}
