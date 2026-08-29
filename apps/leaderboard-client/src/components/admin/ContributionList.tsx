'use client';

import { Table } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Pencil, Trash2 } from 'lucide-react';
import type { Contribution, User, Challenge } from '../../../../../packages/database-service/domain/entities';

interface ContributionListProps {
  contributions: Contribution[];
  users: User[];
  challenges: Challenge[];
  onEdit: (contribution: Contribution) => void;
  onDelete: (id: string) => void;
}

export function ContributionList({ contributions, users, challenges, onEdit, onDelete }: ContributionListProps) {
  const columns = [
    {
      key: 'title',
      header: 'Contribution',
      render: (contrib: Contribution) => (
        <div>
          <div className="font-medium text-white">{contrib.title}</div>
          <div className="mt-0.5">
            <Badge label={contrib.type} />
          </div>
        </div>
      ),
    },
    {
      key: 'user',
      header: 'User',
      render: (contrib: Contribution) => {
        const user = users.find(u => u.uuid === contrib.user_id);
        return (
          <div className="text-sm">
            <div className="text-white/70">{user?.full_name ?? <span className="text-white/30 italic">Unknown</span>}</div>
            {user && <div className="text-xs text-white/40">@{user.github_username}</div>}
          </div>
        );
      },
      width: '180px',
    },
    {
      key: 'challenge',
      header: 'Challenge',
      render: (contrib: Contribution) => {
        const challenge = challenges.find(c => c.uuid === contrib.challenge_id);
        return (
          <div className="text-sm text-white/60">{challenge?.title ?? <span className="text-white/30 italic">—</span>}</div>
        );
      },
      width: '180px',
    },
    {
      key: 'score',
      header: 'Score',
      render: (contrib: Contribution) => {
        const score = (contrib.evaluation as any)?.globalScore ?? null;
        return (
          <div className="text-sm font-medium text-primary-100">
            {score !== null ? score.toFixed(1) : <span className="text-white/30">—</span>}
          </div>
        );
      },
      width: '70px',
    },
    {
      key: 'reward',
      header: 'Reward',
      render: (contrib: Contribution) => (
        <div className="text-sm font-medium text-brandCP">{contrib.reward} CP</div>
      ),
      width: '90px',
    },
    {
      key: 'actions',
      header: '',
      render: (contrib: Contribution) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => onEdit(contrib)} title="Edit contribution">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="danger" size="sm" onClick={() => onDelete(contrib.uuid)} title="Delete contribution">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
      width: '90px',
    },
  ];

  return <Table data={contributions} columns={columns} emptyMessage="No contributions found" />;
}
