'use client';

import { Table } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import type { Contribution, User, Challenge } from '../../../../../packages/database-service/domain/entities';

interface ContributionListProps {
  contributions: Contribution[];
  users: User[];
  challenges: Challenge[];
}

export function ContributionList({ contributions, users, challenges }: ContributionListProps) {
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
  ];

  return <Table data={contributions} columns={columns} emptyMessage="No contributions found" />;
}
