'use client';

import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import type { Challenge } from '../../../../../packages/database-service/domain/entities';

interface ChallengeListProps {
  challenges: Challenge[];
  onEdit: (challenge: Challenge) => void;
  onDelete: (id: string) => void;
  onTeam: (challenge: Challenge) => void;
  onSync: (id: string) => void;
  onClose: (id: string) => void;
}

export function ChallengeList({ challenges, onEdit, onDelete, onTeam, onSync, onClose }: ChallengeListProps) {
  const columns = [
    {
      key: 'title',
      header: 'Title',
      render: (challenge: Challenge) => (
        <div>
          <div className="font-medium">{challenge.title}</div>
          <div className="text-xs text-white/50">#{challenge.index}</div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (challenge: Challenge) => <Badge label={challenge.status} />,
      width: '120px',
    },
    {
      key: 'dates',
      header: 'Dates',
      render: (challenge: Challenge) => (
        <div className="text-sm">
          <div>{new Date(challenge.start_date).toLocaleDateString()}</div>
          <div className="text-white/50">→ {new Date(challenge.end_date).toLocaleDateString()}</div>
        </div>
      ),
      width: '150px',
    },
    {
      key: 'reward',
      header: 'CP Reward',
      render: (challenge: Challenge) => (
        <span className="text-brandCP font-medium">{challenge.contribution_points_reward}</span>
      ),
      width: '100px',
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (challenge: Challenge) => (
        <div className="flex gap-1 flex-wrap">
          <Button size="sm" variant="secondary" onClick={() => onTeam(challenge)}>
            👥
          </Button>
          <Button size="sm" variant="secondary" onClick={() => onSync(challenge.uuid)}>
            🔄
          </Button>
          <Button size="sm" variant="secondary" onClick={() => onClose(challenge.uuid)}>
            🏆
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onEdit(challenge)}>
            ✏️
          </Button>
          <Button size="sm" variant="danger" onClick={() => onDelete(challenge.uuid)}>
            🗑️
          </Button>
        </div>
      ),
      width: '220px',
    },
  ];

  return <Table data={challenges} columns={columns} emptyMessage="No challenges found" />;
}
