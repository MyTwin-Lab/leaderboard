'use client';

import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import type { Repo, Project } from '../../../../../packages/database-service/domain/entities';

interface RepoListProps {
  repos: Repo[];
  projects: Project[];
  onLinkToChallenge: (repoId: string, repoTitle: string) => void;
  onDelete: (id: string) => void;
}

export function RepoList({ repos, projects, onLinkToChallenge, onDelete }: RepoListProps) {
  const columns = [
    {
      key: 'title',
      header: 'Title',
      render: (repo: Repo) => (
        <div>
          <div className="font-medium">{repo.title}</div>
          <div className="text-xs text-white/50">
            <Badge label={repo.type} />
          </div>
        </div>
      ),
    },
    {
      key: 'external_repo_id',
      header: 'External ID',
      render: (repo: Repo) => (
        <div className="text-sm text-white/70">{repo.external_repo_id || '—'}</div>
      ),
    },
    {
      key: 'project',
      header: 'Project',
      render: (repo: Repo) => {
        const project = projects.find(p => p.uuid === repo.project_id);
        return (
          <div className="text-sm text-white/70">{project?.title || 'Unknown'}</div>
        );
      },
      width: '200px',
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (repo: Repo) => (
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => onLinkToChallenge(repo.uuid, repo.title)}>
            🔗 Link
          </Button>
          <Button size="sm" variant="danger" onClick={() => onDelete(repo.uuid)}>
            Delete
          </Button>
        </div>
      ),
      width: '180px',
    },
  ];

  return <Table data={repos} columns={columns} emptyMessage="No repositories found" />;
}
