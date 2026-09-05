import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import {
  ChallengeRepository,
  ChallengeTeamRepository,
} from '../../../../../../../../packages/database-service/repositories';
import { resolveWorkspaceOwner } from '../../../../../../../../packages/services/challenge/group';
import { z } from 'zod';

const challengeRepo = new ChallengeRepository();
const challengeTeamRepo = new ChallengeTeamRepository();

const bodySchema = z.object({
  repo_url: z.string().trim().regex(
    /^https:\/\/github\.com\/[^/?#]+\/[^/?#]+/,
    'repo_url must be a public GitHub repository URL'
  ),
});

async function getSession(request: NextRequest) {
  const token = request.cookies.get('access_token')?.value;
  if (!token) return null;
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    return { userId: payload.userId as string, role: payload.role as string };
  } catch { return null; }
}

// PATCH /api/challenges/[id]/workspace — mode own_repo : le contributeur
// déclare (ou change) l'URL du repo GitHub public qui porte son livrable.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const { id: challengeId } = await params;

    const challenge = await challengeRepo.findById(challengeId);
    if (!challenge) return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    if (challenge.type !== 'code' || (challenge.workspace_mode ?? 'provided_repo') !== 'own_repo') {
      return NextResponse.json({ error: 'This challenge does not accept contributor repos' }, { status: 400 });
    }

    const membership = await challengeTeamRepo.findByChallengeAndUser(challengeId, session.userId);
    if (!membership) return NextResponse.json({ error: 'Join the challenge first' }, { status: 403 });

    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid repo_url' }, { status: 400 });
    }

    // Le repo se déclare sur la participation du porteur : un groupe livre
    // depuis un seul dépôt. En solo le porteur est l'appelant lui-même.
    const ownerId = await resolveWorkspaceOwner(challengeId, session.userId, { challengeTeamRepo });
    const participation = await challengeTeamRepo.updateWorkspace(challengeId, ownerId, {
      workspace_provider: 'external',
      workspace_url: parsed.data.repo_url,
      workspace_status: 'ready',
    });
    return NextResponse.json({ participation });
  } catch (error) {
    console.error('Error updating workspace:', error);
    return NextResponse.json({ error: 'Failed to update workspace' }, { status: 500 });
  }
}
