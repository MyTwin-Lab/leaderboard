'use client';

import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import type { SyncMeeting } from '../../../../../packages/database-service/domain/entities';

interface MeetingListProps {
  meetings: SyncMeeting[];
  onDelete: (id: string) => void;
  onViewParticipants: (meeting: SyncMeeting) => void;
}

const statusColors: Record<string, string> = {
  scheduled: 'bg-blue-500/10 text-blue-400',
  in_progress: 'bg-yellow-500/10 text-yellow-400',
  completed: 'bg-green-500/10 text-green-400',
  cancelled: 'bg-red-500/10 text-red-400',
  analyzed: 'bg-purple-500/10 text-purple-400',
};

function formatDate(date: Date | string) {
  return new Date(date).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function MeetingList({ meetings, onDelete, onViewParticipants }: MeetingListProps) {
  if (meetings.length === 0) {
    return <p className="py-8 text-center text-sm text-white/40">No meetings found</p>;
  }

  return (
    <div className="divide-y divide-white/5">
      {meetings.map((meeting) => (
        <div key={meeting.uuid} className="flex items-center justify-between gap-4 px-3 py-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate font-medium text-white">{meeting.title}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[meeting.status] ?? 'bg-white/10 text-white/60'}`}
              >
                {meeting.status}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/50">
              <span>Start: {formatDate(meeting.start_time)}</span>
              <span>End: {formatDate(meeting.end_time)}</span>
              {meeting.meet_link && (
                <a
                  href={meeting.meet_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brandCP hover:underline"
                >
                  Meet Link
                </a>
              )}
            </div>
            {meeting.description && (
              <p className="mt-1 truncate text-xs text-white/40">{meeting.description}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => onViewParticipants(meeting)}>
              Participants
            </Button>
            <Button variant="danger" size="sm" onClick={() => onDelete(meeting.uuid)}>
              Cancel
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
