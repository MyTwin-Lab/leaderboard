import { NextRequest, NextResponse } from 'next/server';
import { AccountMergeRepository } from '../../../../../../../packages/database-service/repositories';
import { z } from 'zod';

const accountMergeRepo = new AccountMergeRepository();

const mergeSchema = z.object({
  placeholderId: z.string().uuid(),
  googleAccountId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { placeholderId, googleAccountId } = mergeSchema.parse(body);
    const merged = await accountMergeRepo.merge(placeholderId, googleAccountId);
    return NextResponse.json(merged);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : 'Failed to merge accounts';
    console.error('Error merging accounts:', error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
