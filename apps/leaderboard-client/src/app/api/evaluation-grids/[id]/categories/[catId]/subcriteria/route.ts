import { NextRequest, NextResponse } from 'next/server';
import { EvaluationGridsRepository } from '../../../../../../../../../../packages/database-service/repositories/evaluationGrids.repo.js';
import { verifyAdmin } from '@/lib/auth';
import { z } from 'zod';

const createSubcriterionSchema = z.object({
  criterion: z.string().min(1).max(120),
  description: z.string().optional(),
  weight: z.number().min(0).max(1).optional(),
  metrics: z.array(z.string()).optional(),
  indicators: z.array(z.string()).optional(),
  scoring_excellent: z.string().optional(),
  scoring_good: z.string().optional(),
  scoring_average: z.string().optional(),
  scoring_poor: z.string().optional(),
  position: z.number().int().nonnegative().default(0),
});

const gridRepo = new EvaluationGridsRepository();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; catId: string }> }
) {
  try {
    const payload = await verifyAdmin(request);
    if (!payload) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { catId } = await params;
    const subcriteria = await gridRepo.findSubcriteria(catId);
    return NextResponse.json(subcriteria);
  } catch (error) {
    console.error('[Subcriteria] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch subcriteria' }, { status: 500 });
  }
}

export async function POST(
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
    const parsed = createSubcriterionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const subcriterion = await gridRepo.createSubcriterion({
      category_id: catId,
      ...parsed.data,
    });

    return NextResponse.json(subcriterion, { status: 201 });
  } catch (error) {
    console.error('[Subcriteria] POST error:', error);
    return NextResponse.json({ error: 'Failed to create subcriterion' }, { status: 500 });
  }
}
