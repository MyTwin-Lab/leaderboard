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
      header: 'Title',
      render: (contrib: Contribution) => (
        <div>
          <div className="font-medium">{contrib.title}</div>
          <div className="text-xs text-white/50">
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
          <div className="text-sm text-white/70">
            {user ? `${user.full_name} (@${user.github_username})` : 'Unknown'}
          </div>
        );
      },
      width: '200px',
    },
    {
      key: 'challenge',
      header: 'Challenge',
      render: (contrib: Contribution) => {
        const challenge = challenges.find(c => c.uuid === contrib.challenge_id);
        return (
          <div className="text-sm text-white/70">{challenge?.title || 'Unknown'}</div>
        );
      },
      width: '200px',
    },
    {
      key: 'score',
      header: 'Score',
      render: (contrib: Contribution) => {
        const score = (contrib.evaluation as any)?.globalScore || 0;
        return (
          <div className="text-sm font-medium text-primary-100">{score.toFixed(1)}</div>
        );
      },
      width: '80px',
    },
    {
      key: 'reward',
      header: 'Reward',
      render: (contrib: Contribution) => (
        <div className="text-sm font-medium text-brandCP">{contrib.reward} CP</div>
      ),
      width: '100px',
    },
  ];

  return <Table data={contributions} columns={columns} emptyMessage="No contributions found" />;
}
