'use client';

import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Pencil, Trash2, Users, RefreshCw, Trophy } from 'lucide-react';
import type { Challenge } from '../../../../../packages/database-service/domain/entities';

interface ChallengeListProps {
  challenges: Challenge[];
  onEdit: (challenge: Challenge) => void;
  onDelete: (id: string) => void;
  onTeam: (challenge: Challenge) => void;
  onSync: (id: string) => void;
  onClose: (id: string) => void;
  actionLoading?: string | null;
}

export function ChallengeList({ challenges, onEdit, onDelete, onTeam, onSync, onClose, actionLoading }: ChallengeListProps) {
  const columns = [
    {
      key: 'title',
      header: 'Challenge',
      render: (challenge: Challenge) => (
        <div>
          <div className="font-medium text-white">{challenge.title}</div>
          <div className="text-xs text-white/40">#{challenge.index}</div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (challenge: Challenge) => <Badge label={challenge.status} />,
      width: '110px',
    },
    {
      key: 'dates',
      header: 'Period',
      render: (challenge: Challenge) => (
        <div className="text-sm">
          <div className="text-white/70">{new Date(challenge.start_date).toLocaleDateString('fr-FR')}</div>
          <div className="text-white/40">→ {new Date(challenge.end_date).toLocaleDateString('fr-FR')}</div>
        </div>
      ),
      width: '130px',
    },
    {
      key: 'reward',
      header: 'Reward',
      render: (challenge: Challenge) => (
        <span className="font-medium text-brandCP">{challenge.contribution_points_reward} CP</span>
      ),
      width: '90px',
    },
    {
      key: 'actions',
      header: '',
      render: (challenge: Challenge) => (
        <div className="flex items-center gap-1">
          <Button size="sm" variant="secondary" onClick={() => onTeam(challenge)} title="Manage team">
            <Users className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onSync(challenge.uuid)}
            disabled={actionLoading === `sync-${challenge.uuid}`}
            title="Run sync evaluation"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${actionLoading === `sync-${challenge.uuid}` ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onClose(challenge.uuid)}
            disabled={actionLoading === `close-${challenge.uuid}`}
            title="Close & distribute rewards"
          >
            <Trophy className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onEdit(challenge)} title="Edit">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="danger" onClick={() => onDelete(challenge.uuid)} title="Delete">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
      width: '200px',
    },
  ];

  return <Table data={challenges} columns={columns} emptyMessage="No challenges yet" />;
}
