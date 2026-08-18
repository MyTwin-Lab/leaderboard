'use client';

import { Video } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';

export interface SectionMeeting {
  uuid: string;
  title: string;
  start_time: string;
  end_time: string;
  meet_link?: string;
  status: string;
}

function fmtDate(iso: string, opts?: Intl.DateTimeFormatOptions) {
  return new Date(iso).toLocaleDateString('en-US', opts ?? { month: 'short', day: 'numeric' });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function durationMin(start: string, end: string) {
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
}

/**
 * Top-level meetings section — rendered once above the active tab panel (see
 * ContributorTabs' `extra` slot), visible regardless of which tab is
 * selected. Two cards: the nearest upcoming meeting (with any further
 * upcoming ones listed underneath) and a compact past-meetings list.
 */
export function MeetingsSection({
  meetings, upcomingMeetings, pastMeetings, onOpen, onJoin,
}: {
  meetings: SectionMeeting[];
  upcomingMeetings: SectionMeeting[];
  pastMeetings: SectionMeeting[];
  onOpen: (meetingId: string) => void;
  onJoin: (meetLink: string) => void;
}) {
  if (meetings.length === 0) return null;

  const next = upcomingMeetings[0];
  const laterUpcoming = upcomingMeetings.slice(1);

  return (
    <div className="grid gap-3.5 sm:grid-cols-2">
      {/* Next meeting */}
      <div className="space-y-3 rounded-[20px] border border-white/[0.08] bg-white/[0.03] p-4">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-white/40">Next meeting</span>
          {next?.status === 'in_progress' && (
            <span className="flex items-center gap-1.5 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-bold text-red-400">
              <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
              LIVE
            </span>
          )}
        </div>

        {!next ? (
          <p className="py-2 text-xs text-white/25">No upcoming meeting</p>
        ) : (
          <>
            <button
              onClick={() => onOpen(next.uuid)}
              className="group flex w-full items-center gap-4 text-left"
            >
              <div className="flex w-11 shrink-0 flex-col items-center rounded-2xl bg-white/[0.04] py-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-white/35">
                  {fmtDate(next.start_time, { weekday: 'short' })}
                </span>
                <span className="text-xl font-semibold leading-tight text-white">{new Date(next.start_time).getDate()}</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-white/35">
                  {fmtDate(next.start_time, { month: 'short' })}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white group-hover:text-brandCP transition-colors">{next.title}</p>
                <p className="text-xs text-white/35">
                  {fmtTime(next.start_time)} – {fmtTime(next.end_time)} · {durationMin(next.start_time, next.end_time)}min
                </p>
              </div>
              {next.meet_link && (
                <span
                  role="button"
                  onClick={e => { e.stopPropagation(); onJoin(next.meet_link!); }}
                  style={{ color: '#fff' }}
                  className="shrink-0 flex items-center gap-1.5 rounded-full bg-brandCP px-4 py-2 text-xs font-semibold"
                >
                  <Video className="h-3 w-3" style={{ color: '#fff' }} />
                  Join
                </span>
              )}
            </button>

            {laterUpcoming.length > 0 && (
              <div className="space-y-1 border-t border-white/[0.06] pt-2">
                {laterUpcoming.map(m => (
                  <button
                    key={m.uuid}
                    onClick={() => onOpen(m.uuid)}
                    className="flex w-full items-center gap-3 rounded-lg px-1 py-1 text-left hover:bg-white/[0.04]"
                  >
                    <span className="w-14 shrink-0 text-[11px] text-white/30">{fmtDate(m.start_time)}</span>
                    <span className="min-w-0 flex-1 truncate text-xs text-white/50">{m.title}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Past meetings */}
      <div className="space-y-2.5 rounded-[20px] border border-white/[0.08] bg-white/[0.03] p-4">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-white/40">Past meetings</span>
        {pastMeetings.length === 0 ? (
          <p className="py-2 text-xs text-white/25">No past meeting</p>
        ) : (
          <div className="space-y-0.5">
            {pastMeetings.slice(0, 5).map(m => (
              <button
                key={m.uuid}
                onClick={() => onOpen(m.uuid)}
                className="group flex w-full items-center gap-3 rounded-lg px-1 py-1.5 text-left transition-colors hover:bg-white/[0.04]"
              >
                <span className="w-14 shrink-0 text-[11px] tabular-nums text-white/25">{fmtDate(m.start_time)}</span>
                <span className="min-w-0 flex-1 truncate text-xs text-white/50 group-hover:text-white/70 transition-colors">{m.title}</span>
                <Badge label={m.status === 'processed' ? 'Processed' : 'Completed'} variant="muted" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
