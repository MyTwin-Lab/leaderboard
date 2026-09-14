import { SyncMeetingRepository } from '../../../../../../packages/database-service/repositories/syncMeeting.repo.js';
import type {
  SyncMeeting,
  MeetingParticipant,
  MeetingAnalysis,
} from '../../../../../../packages/database-service/domain/entities';
import { canAccessChallengeInternals } from '@/lib/server/managerAuth';

/**
 * Lecture des meetings : réservée aux admins, managers et membres du challenge.
 *
 * Le meeting est lu via le repository et non `SyncMeetingService`, dont le
 * constructeur lève sans compte de service Google Workspace.
 *
 * `null` couvre à la fois « absent » et « accès refusé » : la route répond 404
 * dans les deux cas, pour ne pas révéler l'existence d'un meeting.
 */
export async function loadAccessibleMeeting(
  meetingId: string,
  user: { id: string; role: string },
): Promise<SyncMeeting | null> {
  const meeting = await new SyncMeetingRepository().findById(meetingId);
  if (!meeting) return null;
  if (!(await canAccessChallengeInternals(user, meeting.challenge_id))) return null;
  return meeting;
}

/** Liste blanche : ni identifiants calendrier ni identifiants de conférence. */
export function toMeetingView(meeting: SyncMeeting) {
  return {
    uuid: meeting.uuid,
    title: meeting.title,
    description: meeting.description,
    challenge_id: meeting.challenge_id,
    start_time: meeting.start_time,
    end_time: meeting.end_time,
    meet_link: meeting.meet_link,
    status: meeting.status,
    created_by: meeting.created_by,
  };
}

/** `google_user_id` réservé aux admins : il vise aussi des personnes sans compte. */
export function toParticipantView(participant: MeetingParticipant, isAdmin: boolean) {
  if (isAdmin) return participant;
  return {
    uuid: participant.uuid,
    user_id: participant.user_id,
    display_name: participant.display_name,
  };
}

/**
 * Liste blanche hors admin : pas d'`error_message` (détails internes), ni
 * aucun champ ajouté plus tard sans décision explicite — les poids
 * individuels (`contribution_signals`, contraires à la SPEC §9 du challenge
 * 008) ont existé et ne doivent pas revenir par ce chemin.
 */
export function toAnalysisView(analysis: MeetingAnalysis, isAdmin: boolean) {
  if (isAdmin) return analysis;
  return {
    summary: analysis.summary,
    decisions: analysis.decisions,
    actions: analysis.actions,
    status: analysis.status,
    processed_at: analysis.processed_at,
  };
}
