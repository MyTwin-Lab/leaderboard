import { NextRequest, NextResponse } from 'next/server';
import { EvaluationGridsRepository } from '../../../../../../../../packages/database-service/repositories/evaluationGrids.repo.js';
import { verifyAdmin } from '@/lib/auth';
import { z } from 'zod';

const createCategorySchema = z.object({
  name: z.string().min(1).max(120),
  weight: z.number().min(0).max(1),
  type: z.enum(['objective', 'mixed', 'subjective', 'contextual']),
  position: z.number().int().nonnegative().default(0),
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
    const categories = await gridRepo.findCategoriesByGridId(id);
    return NextResponse.json(categories);
  } catch (error) {
    console.error('[EvaluationGridCategories] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
  }
}

export async function POST(
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
    const parsed = createCategorySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const category = await gridRepo.createCategory({
      grid_id: id,
      ...parsed.data,
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    console.error('[EvaluationGridCategories] POST error:', error);
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 });
  }
}
