import { NextRequest, NextResponse } from 'next/server';
import { ChallengeTeamRepository } from '../../../../../../../../packages/database-service/repositories';
import { verifyRequestToken, getSessionUser } from '@/lib/auth';
import { isManagerOfChallenge } from '@/lib/server/managerAuth';
import { toPublicTeamMember } from '@/lib/public/overview';
import { z } from 'zod';

const challengeTeamRepo = new ChallengeTeamRepository();

const addMemberSchema = z.object({
  user_id: z.string().uuid(),
});

// GET /api/challenges/[id]/team - Récupérer l'équipe d'un challenge
//
// Réservé aux admins et au manager du challenge (la modale Team de l'admin).
// `findTeamMembers` renvoie les comptes complets : chaque membre est réduit à
// ce que la modale affiche, sans email ni `google_user_id`.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await verifyRequestToken(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { id } = await params;
    const isAdmin = session.role === 'admin';
    const isManager = !isAdmin && await isManagerOfChallenge(session.userId, id);
    if (!isAdmin && !isManager) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const team = await challengeTeamRepo.findTeamMembers(id);
    return NextResponse.json(team.map(m => {
      const { uuid, full_name, github_username, avatar_url } = toPublicTeamMember(m);
      return { uuid, full_name, github_username, avatar_url };
    }));
  } catch (error) {
    console.error('Error fetching team:', error);
    return NextResponse.json(
      { error: 'Failed to fetch team' },
      { status: 500 }
    );
  }
}

// POST /api/challenges/[id]/team - Ajouter un membre à l'équipe
//
// Mêmes droits que le GET, rôle relu en base : le proxy ne garde que
// l'authentification, pas l'autorisation sur ce challenge.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { id } = await params;
    if (user.role !== 'admin' && !(await isManagerOfChallenge(user.id, id))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const body = await request.json();
    const validated = addMemberSchema.parse(body);
    
    await challengeTeamRepo.create({
      challenge_id: id,
      user_id: validated.user_id,
    });
    
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }
    
    console.error('Error adding team member:', error);
    return NextResponse.json(
      { error: 'Failed to add team member' },
      { status: 500 }
    );
  }
}
