'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Plus, Video } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { CreateMeetingDrawer } from '@/components/admin/CreateMeetingDrawer';
import { MeetingsSection, type SectionMeeting } from '@/components/challenges/MeetingsSection';
import { Empty, SectionHeader, StatCard } from '@/components/admin/overviewCards';
import { fetchJson } from '@/lib/fetchJson';
import { emitUiEvent } from '@/lib/uiEvents';
import type { ModuleChallengeSectionProps, ModuleSlots } from '@/lib/moduleSlots';

/**
 * Distribution MyTwin — slots du module meetings
 * ----------------------------------------------
 * La section meetings des pages d'un challenge, l'entrée « Meetings » du menu
 * admin et ce que le module ajoute à l'accueil admin. Rendus seulement quand
 * le module est actif (`mytwin.modules.tsx`) ; leurs routes répondent 404
 * sinon.
 */

const UPCOMING_STATUSES = ['scheduled', 'in_progress'];

const challengeMeetingsKey = (challengeId: string) => ['challenge-meetings', challengeId];

function useChallengeMeetings(challengeId: string, enabled: boolean) {
  return useQuery({
    queryKey: challengeMeetingsKey(challengeId),
    queryFn: async () =>
      ((await fetchJson(`/api/challenges/${challengeId}/meetings`))?.meetings ?? []) as SectionMeeting[],
    enabled: enabled && !!challengeId,
  });
}

function startOf(meeting: { start_time: string }) {
  return new Date(meeting.start_time).getTime();
}

/** Les prochaines, de la plus proche à la plus lointaine ; les passées, de la plus récente à la plus ancienne. */
function splitMeetings(meetings: SectionMeeting[], pastStatuses: readonly string[]) {
  return {
    upcoming: meetings.filter(m => UPCOMING_STATUSES.includes(m.status)).sort((a, b) => startOf(a) - startOf(b)),
    past: meetings.filter(m => pastStatuses.includes(m.status)).sort((a, b) => startOf(b) - startOf(a)),
  };
}

// ─── Page d'un challenge ─────────────────────────────────────────────────────

function ChallengeMeetings({ challengeId, canSeeInternals }: ModuleChallengeSectionProps) {
  const router = useRouter();
  // Membres et admins seulement : un non-membre verrait des réunions qu'il ne
  // peut pas rejoindre, et la route le lui refuse de toute façon.
  const { data: meetings = [] } = useChallengeMeetings(challengeId, canSeeInternals);
  if (!canSeeInternals) return null;

  // Le contributeur garde les réunions annulées dans son historique.
  const { upcoming, past } = splitMeetings(meetings, ['completed', 'processed', 'cancelled']);
  return (
    <MeetingsSection
      meetings={meetings}
      upcomingMeetings={upcoming}
      pastMeetings={past}
      onOpen={id => router.push(`/sync-meetings/${id}`)}
      onJoin={(meetLink, meetingId) => {
        emitUiEvent('ui.meeting_link_opened', { meetingId });
        window.open(meetLink, '_blank');
      }}
    />
  );
}

// ─── Vue de pilotage ─────────────────────────────────────────────────────────

function ManageMeetings({ challengeId }: { challengeId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { data: meetings = [] } = useChallengeMeetings(challengeId, true);
  const { upcoming, past } = splitMeetings(meetings, ['completed', 'processed']);

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-end">
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex items-center gap-1 rounded-full bg-brandCP/10 px-2.5 py-1 text-[11px] font-semibold text-brandCP transition-all hover:bg-brandCP/20"
        >
          <Plus className="h-3 w-3" />
          New meeting
        </button>
      </div>
      <MeetingsSection
        meetings={meetings}
        upcomingMeetings={upcoming}
        pastMeetings={past}
        onOpen={id => router.push(`/sync-meetings/${id}`)}
        onJoin={meetLink => window.open(meetLink, '_blank')}
      />
      {/* Dans document.body : la vue de pilotage anime son contenu avec un
          transform, qui crée un bloc conteneur et casse le position:fixed du
          drawer. Ouvert seulement après un clic, donc toujours côté client. */}
      {drawerOpen && createPortal(
        <CreateMeetingDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          challengeId={challengeId}
          onCreated={() => queryClient.invalidateQueries({ queryKey: challengeMeetingsKey(challengeId) })}
        />,
        document.body,
      )}
    </div>
  );
}

// ─── Accueil admin ───────────────────────────────────────────────────────────

interface AdminMeeting { uuid: string; title: string; start_time: string; status: string; }

/** Tous les meetings, tous challenges confondus : `GET /api/sync-meetings` est réservé à l'admin. */
function useUpcomingMeetings() {
  const query = useQuery({
    queryKey: ['sync-meetings'],
    queryFn: async () => ((await fetchJson('/api/sync-meetings'))?.meetings ?? []) as AdminMeeting[],
  });
  const now = Date.now();
  const upcoming = (query.data ?? []).filter(m => startOf(m) > now).sort((a, b) => startOf(a) - startOf(b));
  return { upcoming, loading: query.isLoading };
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function AdminMeetingsStat() {
  const { upcoming, loading } = useUpcomingMeetings();
  return <StatCard label="Upcoming Meetings" value={upcoming.length} loading={loading} icon={<Video className="h-4 w-4" />} />;
}

function AdminMeetingsTab() {
  const { upcoming, loading } = useUpcomingMeetings();
  const meetings = upcoming.slice(0, 6);
  return (
    <div className="max-w-xl space-y-3">
      <SectionHeader title="Upcoming Meetings" href="/admin/meetings" />
      {loading ? (
        <div className="space-y-2 animate-pulse">{[...Array(4)].map((_, i) => <div key={i} className="h-14 rounded-xl bg-white/5" />)}</div>
      ) : meetings.length === 0 ? <Empty label="No upcoming meetings" /> : (
        <div className="space-y-2">
          {meetings.map(m => (
            <div key={m.uuid} className="flex items-center gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
              <CalendarDays className="h-4 w-4 shrink-0 text-white/25" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{m.title}</p>
                <p className="text-xs text-white/35">{fmtDate(m.start_time)}</p>
              </div>
              <Badge label={m.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export const meetingsSlots: ModuleSlots = {
  key: 'meetings',
  ChallengeSection: ChallengeMeetings,
  ManageSection: ManageMeetings,
  adminNav: [{ href: '/admin/meetings', label: 'Meetings' }],
  AdminStat: AdminMeetingsStat,
  adminTab: { label: 'Meetings', Panel: AdminMeetingsTab },
};
