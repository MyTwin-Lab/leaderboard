import { NextRequest, NextResponse } from 'next/server';
import { EvaluationGridsRepository } from '../../../../../../../../../../../packages/database-service/repositories/evaluationGrids.repo.js';
import { verifyAdmin } from '@/lib/auth';
import { z } from 'zod';

const updateSubcriterionSchema = z.object({
  criterion: z.string().min(1).max(120).optional(),
  description: z.string().optional(),
  weight: z.number().min(0).max(1).optional(),
  metrics: z.array(z.string()).optional(),
  indicators: z.array(z.string()).optional(),
  scoring_excellent: z.string().optional(),
  scoring_good: z.string().optional(),
  scoring_average: z.string().optional(),
  scoring_poor: z.string().optional(),
  position: z.number().int().nonnegative().optional(),
});

const gridRepo = new EvaluationGridsRepository();

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; catId: string; subId: string }> }
) {
  try {
    const payload = await verifyAdmin(request);
    if (!payload) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { subId } = await params;
    const body = await request.json();
    const parsed = updateSubcriterionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const subcriterion = await gridRepo.updateSubcriterion(subId, parsed.data);
    return NextResponse.json(subcriterion);
  } catch (error) {
    console.error('[Subcriterion] PUT error:', error);
    return NextResponse.json({ error: 'Failed to update subcriterion' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; catId: string; subId: string }> }
) {
  try {
    const payload = await verifyAdmin(request);
    if (!payload) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { subId } = await params;
    await gridRepo.deleteSubcriterion(subId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Subcriterion] DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete subcriterion' }, { status: 500 });
  }
}
