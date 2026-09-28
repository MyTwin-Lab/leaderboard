import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyRequestToken } from '@/lib/auth';
import { repositories } from '@/lib/db';
import { canAccessChallengeInternals } from '@/lib/server/managerAuth';
import { isPubliclyVisible } from '@/lib/public/challengeVisibility';
import { SyncMeetingRepository } from '../../../../../../../packages/database-service/repositories/syncMeeting.repo';
import { events } from '../../../../../../../packages/capabilities/events';
import { PlatformRegistry } from '../../../../../../../packages/registry/platform';

type Caller = { id: string; role: string };

/** Ce que l'événement désigne, relu en base ; `null` : absent ou invisible pour l'appelant. */
type TargetCheck = (payload: Record<string, unknown>, caller: Caller) => Promise<Record<string, string> | null>;

const uuid = z.string().uuid();

/**
 * La vérification de chaque événement d'interface. Un type `ui.*` déclaré
 * sans la sienne ici est refusé : il n'entre qu'avec elle.
 */
const TARGET_CHECKS: Record<string, TargetCheck> = {
  // Un challenge que l'appelant peut voir : public, ou dont il voit l'intérieur.
  'ui.challenge_opened': async (payload, caller) => {
    const challengeId = uuid.safeParse(payload.challengeId);
    if (!challengeId.success) return null;
    const challenge = await repositories.challenge.findById(challengeId.data);
    if (!challenge) return null;
    const visible = isPubliclyVisible(challenge) || (await canAccessChallengeInternals(caller, challenge.uuid));
    return visible ? { challengeId: challenge.uuid } : null;
  },
  // Un meeting d'un challenge dont l'appelant voit l'intérieur (déclaré par le module meetings).
  'ui.meeting_link_opened': async (payload, caller) => {
    const meetingId = uuid.safeParse(payload.meetingId);
    if (!meetingId.success) return null;
    const meeting = await new SyncMeetingRepository().findById(meetingId.data);
    if (!meeting || !(await canAccessChallengeInternals(caller, meeting.challenge_id))) return null;
    return { meetingId: meeting.uuid, challengeId: meeting.challenge_id };
  },
};

const bodySchema = z.object({
  type: z.string().startsWith('ui.'),
  payload: z.record(z.string(), z.unknown()).default({}),
});

/**
 * POST /api/events/ui — les événements d'interface (challenge 020, L6).
 *
 * Ils ne prouvent qu'un clic. Seul un compte connecté en émet, seulement les
 * types `ui.*` que la plateforme déclare, et seulement sur un challenge ou un
 * meeting qu'il peut voir. L'utilisateur vient de la session, jamais du corps.
 */
export async function POST(request: NextRequest) {
  try {
    const token = await verifyRequestToken(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

    const { type, payload } = parsed.data;
    const check = TARGET_CHECKS[type];
    if (!check || !PlatformRegistry.isInstalled() || !PlatformRegistry.event(type)) {
      return NextResponse.json({ error: 'Unknown event type' }, { status: 400 });
    }

    const caller: Caller = { id: token.userId, role: token.role };
    const target = await check(payload, caller);
    if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await events.emit(type, { ...target, userId: caller.id });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('POST /api/events/ui error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
