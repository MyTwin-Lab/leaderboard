'use client';

import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Eye, Link2, Trash2 } from 'lucide-react';
import type { Repo, Project } from '../../../../../packages/database-service/domain/entities';

interface RepoListProps {
  repos: Repo[];
  projects: Project[];
  onLinkToChallenge: (repoId: string, repoTitle: string) => void;
  onDelete: (id: string) => void;
  onViewDetail: (repoId: string, repoTitle: string) => void;
}

export function RepoList({ repos, projects, onLinkToChallenge, onDelete, onViewDetail }: RepoListProps) {
  const columns = [
    {
      key: 'title',
      header: 'Repository',
      render: (repo: Repo) => (
        <div>
          <div className="font-medium text-white">{repo.title}</div>
          <div className="mt-0.5">
            <Badge label={repo.type} />
          </div>
        </div>
      ),
    },
    {
      key: 'external_repo_id',
      header: 'External ID',
      render: (repo: Repo) => (
        <div className="text-sm text-white/50 font-mono">{repo.external_repo_id || <span className="italic text-white/25">—</span>}</div>
      ),
    },
    {
      key: 'project',
      header: 'Project',
      render: (repo: Repo) => {
        const project = projects.find(p => p.uuid === repo.project_id);
        return (
          <div className="text-sm text-white/60">{project?.title ?? <span className="text-white/25 italic">Unknown</span>}</div>
        );
      },
      width: '180px',
    },
    {
      key: 'actions',
      header: '',
      render: (repo: Repo) => (
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => onViewDetail(repo.uuid, repo.title)} title="View detail">
            <Eye className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="secondary" onClick={() => onLinkToChallenge(repo.uuid, repo.title)} title="Link to challenge">
            <Link2 className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="danger" onClick={() => onDelete(repo.uuid)} title="Delete">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
      width: '110px',
    },
  ];

  return <Table data={repos} columns={columns} emptyMessage="No repositories yet" />;
}
