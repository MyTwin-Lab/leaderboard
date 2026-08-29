import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ChallengeSignalRepository } from '../../../../../../../../packages/database-service/repositories';
import { getSessionUser } from '@/lib/auth';
import { isManagerOfChallenge } from '@/lib/server/managerAuth';

const signalRepo = new ChallengeSignalRepository();

const createSignalSchema = z.object({
  label: z.string().min(1).max(120),
  description: z.string().optional(),
  reward_cp: z.number().int().nonnegative(),
  icon: z.string().max(32).nullish(),
  position: z.number().int().nonnegative().optional(),
});

// GET /api/challenges/[id]/signals — public read
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const signals = await signalRepo.findByChallenge(id);
    return NextResponse.json(signals);
  } catch (err) {
    console.error('Error fetching challenge signals:', err);
    return NextResponse.json({ error: 'Failed to fetch signals' }, { status: 500 });
  }
}

// POST /api/challenges/[id]/signals — admin/manager only
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { id } = await params;
    const isAdmin = user.role === 'admin';
    const isManager = !isAdmin && await isManagerOfChallenge(user.id, id);
    if (!isAdmin && !isManager) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const validated = createSignalSchema.parse(body);

    const signal = await signalRepo.create({
      challenge_id: id,
      label: validated.label,
      description: validated.description,
      reward_cp: validated.reward_cp,
      icon: validated.icon ?? null,
      position: validated.position ?? 0,
    });

    return NextResponse.json(signal, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: err.issues },
        { status: 400 }
      );
    }
    console.error('Error creating challenge signal:', err);
    return NextResponse.json({ error: 'Failed to create signal' }, { status: 500 });
  }
}
