import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ChallengeSlackConfigRepository } from '../../../../../../../../packages/database-service/repositories';
import { getSessionUser } from '@/lib/auth';
import { isManagerOfChallenge } from '@/lib/server/managerAuth';

const slackConfigRepo = new ChallengeSlackConfigRepository();

const upsertConfigSchema = z.object({
  channel_id: z.string().min(1).max(32),
  channel_name: z.string().max(120).nullish(),
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

// GET /api/challenges/[id]/slack-config — admin/manager only
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await authorize(id);
    if ('error' in auth) return auth.error;

    const config = await slackConfigRepo.findByChallenge(id);
    return NextResponse.json(config);
  } catch (err) {
    console.error('Error fetching slack config:', err);
    return NextResponse.json({ error: 'Failed to fetch slack config' }, { status: 500 });
  }
}

// PUT /api/challenges/[id]/slack-config — admin/manager only
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await authorize(id);
    if ('error' in auth) return auth.error;

    const body = await req.json();
    const validated = upsertConfigSchema.parse(body);

    const config = await slackConfigRepo.upsert({
      challenge_id: id,
      channel_id: validated.channel_id,
      channel_name: validated.channel_name ?? null,
    });

    return NextResponse.json(config);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: err.issues },
        { status: 400 }
      );
    }
    console.error('Error saving slack config:', err);
    return NextResponse.json({ error: 'Failed to save slack config' }, { status: 500 });
  }
}

// DELETE /api/challenges/[id]/slack-config — admin/manager only
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await authorize(id);
    if ('error' in auth) return auth.error;

    await slackConfigRepo.delete(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error deleting slack config:', err);
    return NextResponse.json({ error: 'Failed to delete slack config' }, { status: 500 });
  }
}
