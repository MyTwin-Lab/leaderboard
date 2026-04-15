import { NextRequest, NextResponse } from 'next/server';
import { EvaluationGridsRepository } from '../../../../../../../../../packages/database-service/repositories/evaluationGrids.repo.js';
import { verifyAdmin } from '@/lib/auth';
import { z } from 'zod';

const updateCategorySchema = z.object({
  name: z.string().min(1).max(120).optional(),
  weight: z.number().min(0).max(1).optional(),
  type: z.enum(['objective', 'mixed', 'subjective', 'contextual']).optional(),
  position: z.number().int().nonnegative().optional(),
});

const gridRepo = new EvaluationGridsRepository();

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; catId: string }> }
) {
  try {
    const payload = await verifyAdmin(request);
    if (!payload) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { catId } = await params;
    const body = await request.json();
    const parsed = updateCategorySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const category = await gridRepo.updateCategory(catId, parsed.data);
    return NextResponse.json(category);
  } catch (error) {
    console.error('[EvaluationGridCategory] PUT error:', error);
    return NextResponse.json({ error: 'Failed to update category' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; catId: string }> }
) {
  try {
    const payload = await verifyAdmin(request);
    if (!payload) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { catId } = await params;
    await gridRepo.deleteCategory(catId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[EvaluationGridCategory] DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 });
  }
}
