'use client';

import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Users, Trash2, ExternalLink } from 'lucide-react';
import type { SyncMeeting } from '../../../../../packages/database-service/domain/entities';

interface MeetingListProps {
  meetings: SyncMeeting[];
  onDelete: (id: string) => void;
  onViewParticipants: (meeting: SyncMeeting) => void;
}

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
  const columns = [
    {
      key: 'title',
      header: 'Meeting',
      render: (meeting: SyncMeeting) => (
        <div>
          <div className="font-medium text-white">{meeting.title}</div>
          {meeting.description && (
            <div className="mt-0.5 text-xs text-white/40 truncate max-w-xs">{meeting.description}</div>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (meeting: SyncMeeting) => <Badge label={meeting.status} />,
      width: '110px',
    },
    {
      key: 'schedule',
      header: 'Schedule',
      render: (meeting: SyncMeeting) => (
        <div className="text-sm">
          <div className="text-white/70">{formatDate(meeting.start_time)}</div>
          <div className="text-white/40">→ {formatDate(meeting.end_time)}</div>
        </div>
      ),
      width: '180px',
    },
    {
      key: 'actions',
      header: '',
      render: (meeting: SyncMeeting) => (
        <div className="flex items-center gap-1">
          {meeting.meet_link && (
            <a href={meeting.meet_link} target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="sm" title="Open meet link">
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </a>
          )}
          <Button variant="ghost" size="sm" onClick={() => onViewParticipants(meeting)} title="View participants">
            <Users className="h-3.5 w-3.5" />
          </Button>
          <Button variant="danger" size="sm" onClick={() => onDelete(meeting.uuid)} title="Cancel meeting">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
      width: '110px',
    },
  ];

  return <Table data={meetings} columns={columns} emptyMessage="No meetings yet" />;
}
