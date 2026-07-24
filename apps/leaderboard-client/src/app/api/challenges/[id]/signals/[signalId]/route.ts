import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ChallengeSignalRepository } from '../../../../../../../../../packages/database-service/repositories';
import { getSessionUser } from '@/lib/auth';
import { isManagerOfChallenge } from '@/lib/server/managerAuth';

const signalRepo = new ChallengeSignalRepository();

const updateSignalSchema = z.object({
  label: z.string().min(1).max(120).optional(),
  description: z.string().optional(),
  reward_cp: z.number().int().nonnegative().optional(),
  icon: z.string().max(32).nullish(),
  position: z.number().int().nonnegative().optional(),
});

async function authorize(challengeId: string) {
  const user = await getSessionUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const isAdmin = user.role === 'admin';
  const isManager = !isAdmin && await isManagerOfChallenge(user.id, challengeId);
  if (!isAdmin && !isManager) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { user };
}

// PUT /api/challenges/[id]/signals/[signalId] — admin/manager only
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; signalId: string }> }
) {
  try {
    const { id, signalId } = await params;
    const auth = await authorize(id);
    if ('error' in auth) return auth.error;

    const existing = await signalRepo.findById(signalId);
    if (!existing || existing.challenge_id !== id) {
      return NextResponse.json({ error: 'Signal not found' }, { status: 404 });
    }

    const body = await req.json();
    const validated = updateSignalSchema.parse(body);
    const updated = await signalRepo.update(signalId, validated);
    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: err.issues },
        { status: 400 }
      );
    }
    console.error('Error updating challenge signal:', err);
    return NextResponse.json({ error: 'Failed to update signal' }, { status: 500 });
  }
}

// DELETE /api/challenges/[id]/signals/[signalId] — admin/manager only
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; signalId: string }> }
) {
  try {
    const { id, signalId } = await params;
    const auth = await authorize(id);
    if ('error' in auth) return auth.error;

    const existing = await signalRepo.findById(signalId);
    if (!existing || existing.challenge_id !== id) {
      return NextResponse.json({ error: 'Signal not found' }, { status: 404 });
    }

    await signalRepo.delete(signalId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error deleting challenge signal:', err);
    return NextResponse.json({ error: 'Failed to delete signal' }, { status: 500 });
  }
}
