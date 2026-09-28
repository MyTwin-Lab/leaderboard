'use client';

import Link from 'next/link';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Pencil, Trash2, Users, Trophy, ExternalLink } from 'lucide-react';
import { FlowIcon } from '@/components/ui/FlowIcon';
import { flowCatalog } from '@/distribution/mytwin.flows';
import type { Challenge } from '../../../../../packages/database-service/domain/entities';

interface ChallengeListProps {
  challenges: Challenge[];
  onEdit: (challenge: Challenge) => void;
  onDelete: (id: string) => void;
  onTeam: (challenge: Challenge) => void;
  onClose: (id: string) => void;
  actionLoading?: string | null;
}

export function ChallengeList({ challenges, onEdit, onDelete, onTeam, onClose, actionLoading }: ChallengeListProps) {
  const columns = [
    {
      key: 'title',
      header: 'Challenge',
      render: (challenge: Challenge) => (
        <div className="flex items-center gap-2.5">
          <div>
            <div className="font-medium text-white">{challenge.title}</div>
            <div className="text-xs text-white/35">#{challenge.index}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (challenge: Challenge) => {
        // Nom et icône viennent du flow ; un type absent ou inconnu s'affiche
        // comme le flow par défaut.
        const { icon, label } = flowCatalog.resolve(challenge.type);
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[11px] font-medium text-white/50">
            <FlowIcon icon={icon} className="h-3 w-3" />
            {label}
          </span>
        );
      },
      width: '90px',
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
        challenge.start_date || challenge.end_date ? (
          <div className="text-sm">
            <div className="text-white/60">{challenge.start_date ? new Date(challenge.start_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '-'}</div>
            <div className="text-white/35">→ {challenge.end_date ? new Date(challenge.end_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}</div>
          </div>
        ) : (
          <span className="text-sm text-white/25">-</span>
        )
      ),
      width: '130px',
    },
    {
      key: 'reward',
      header: 'Reward',
      render: (challenge: Challenge) => (
        <span className="font-semibold text-brandCP">{challenge.contribution_points_reward.toLocaleString()} <span className="text-[11px]">CP</span></span>
      ),
      width: '90px',
    },
    {
      key: 'actions',
      header: '',
      render: (challenge: Challenge) => (
        <div className="flex items-center gap-1">
          <Link href={`/admin/challenges/${challenge.uuid}`} title="Open manager view">
            <Button size="sm" variant="secondary"><ExternalLink className="h-3.5 w-3.5" /></Button>
          </Link>
          <Button size="sm" variant="secondary" onClick={() => onTeam(challenge)} title="Manage team">
            <Users className="h-3.5 w-3.5" />
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
      width: '240px',
    },
  ];

  return <Table data={challenges} columns={columns} emptyMessage="No challenges yet" />;
}
