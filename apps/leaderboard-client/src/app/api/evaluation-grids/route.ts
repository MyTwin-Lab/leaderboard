import { NextRequest, NextResponse } from 'next/server';
import { EvaluationGridsRepository } from '../../../../../../packages/database-service/repositories/evaluationGrids.repo.js';
import { verifyAdmin } from '@/lib/auth';
import { z } from 'zod';

const createGridSchema = z.object({
  slug: z.string().min(1).max(64),
  name: z.string().min(1).max(120),
  description: z.string().optional(),
  version: z.number().int().positive().default(1),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
  instructions: z.string().optional(),
});

const gridRepo = new EvaluationGridsRepository();

export async function GET(request: NextRequest) {
  try {
    const payload = await verifyAdmin(request);
    if (!payload) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const grids = await gridRepo.findAll();
    return NextResponse.json(grids);
  } catch (error) {
    console.error('[EvaluationGrids] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch grids' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await verifyAdmin(request);
    if (!payload) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createGridSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const grid = await gridRepo.createGrid({
      ...parsed.data,
      created_by: payload.userId,
    });

    return NextResponse.json(grid, { status: 201 });
  } catch (error) {
    console.error('[EvaluationGrids] POST error:', error);
    return NextResponse.json({ error: 'Failed to create grid' }, { status: 500 });
  }
}
