'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/Badge';
import type { TaskWorkspace } from '../../../../../packages/database-service/domain/entities';

type WorkspaceWithAssignees = TaskWorkspace & {
  assignees: { full_name: string; github_username?: string }[];
};

interface RepoDetailProps {
  repoId: string;
  repoTitle: string;
  onClose: () => void;
}

export function RepoDetail({ repoId, repoTitle, onClose }: RepoDetailProps) {
  const [workspaces, setWorkspaces] = useState<WorkspaceWithAssignees[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWorkspaces = async () => {
      try {
        const res = await fetch(`/api/repos/${repoId}/workspaces`);
        const data = await res.json();
        setWorkspaces(data);
      } catch (error) {
        console.error('Error fetching workspaces:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchWorkspaces();
  }, [repoId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-2xl bg-background border border-white/10 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">
            Repo: {repoTitle}
          </h2>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        <div>
          <h3 className="text-sm font-medium text-white/80 mb-3">Task Workspaces</h3>

          {loading ? (
            <div className="text-white/60 text-sm">Loading...</div>
          ) : workspaces.length === 0 ? (
            <p className="text-sm text-white/50">No task workspaces linked to this repo.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-white/70">
                <thead>
                  <tr className="border-b border-white/10 text-white/50 text-xs uppercase tracking-wide">
                    <th className="text-left py-2 pr-4">Ref</th>
                    <th className="text-left py-2 pr-4">Status</th>
                    <th className="text-left py-2 pr-4">URL</th>
                    <th className="text-left py-2">Assignee(s)</th>
                  </tr>
                </thead>
                <tbody>
                  {workspaces.map((ws) => (
                    <tr key={ws.task_id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="py-2 pr-4 font-mono text-xs">{ws.workspace_ref || '—'}</td>
                      <td className="py-2 pr-4">
                        {ws.workspace_status ? (
                          <Badge label={ws.workspace_status} />
                        ) : '—'}
                      </td>
                      <td className="py-2 pr-4">
                        {ws.workspace_url ? (
                          <a
                            href={ws.workspace_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary-300 hover:underline truncate max-w-[200px] block"
                          >
                            {ws.workspace_url}
                          </a>
                        ) : '—'}
                      </td>
                      <td className="py-2">
                        {ws.assignees.length === 0 ? (
                          <span className="text-white/30">—</span>
                        ) : (
                          <div className="flex flex-col gap-0.5">
                            {ws.assignees.map((a) => (
                              <span key={a.github_username ?? a.full_name}>
                                {a.full_name}
                                {a.github_username && (
                                  <span className="text-white/40 ml-1">@{a.github_username}</span>
                                )}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
