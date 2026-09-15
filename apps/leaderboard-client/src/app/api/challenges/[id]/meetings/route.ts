import { NextRequest, NextResponse } from 'next/server';
import { SyncMeetingRepository } from '../../../../../../../../packages/database-service/repositories/syncMeeting.repo.js';
import { getSessionUser } from '@/lib/auth';
import { canAccessChallengeInternals, isManagerOfChallenge } from '@/lib/server/managerAuth';
import { moduleNotFoundResponse } from '@/lib/server/modules';
import { toMeetingView } from '@/app/api/sync-meetings/meetingAccess';

// GET /api/challenges/[id]/meetings — les meetings d'un challenge, pour la
// section meetings de la page du challenge et de sa vue de pilotage.
//
// Sortis de l'overview avec le module meetings (challenge 020, L6) : désactivé,
// le module n'a plus de route, et l'overview ne dit rien de lui.
//
// Admins, managers et membres du challenge seulement. Un membre reçoit la
// liste blanche de `toMeetingView` (lien Meet compris, puisqu'il peut entrer) ;
// admins et managers reçoivent la ligne entière, comme la vue de pilotage la
// lisait dans l'overview.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const disabled = await moduleNotFoundResponse('meetings');
    if (disabled) return disabled;

    // Rôle relu en base : un rôle retiré ne survit pas jusqu'à l'expiration du JWT.
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    if (!(await canAccessChallengeInternals(user, id))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Le repository et non SyncMeetingService : le service instancie les
    // clients Google dans son constructeur, qui lèvent sans compte de service.
    const meetings = await new SyncMeetingRepository().findByChallengeId(id);
    const privileged = user.role === 'admin' || (await isManagerOfChallenge(user.id, id));
    return NextResponse.json({ meetings: privileged ? meetings : meetings.map(toMeetingView) });
  } catch (error) {
    console.error('[ChallengeMeetings] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch meetings' }, { status: 500 });
  }
}
