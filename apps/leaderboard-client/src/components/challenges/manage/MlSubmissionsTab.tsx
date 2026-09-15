'use client';

import { useQuery } from '@tanstack/react-query';
import { Cpu, Database, ExternalLink, GitBranch, Package } from 'lucide-react';
import { fetchJson } from '@/lib/fetchJson';
import { flowActionUrl } from '@/lib/challengeActions';
import { InitialsAvatar } from '@/components/ui/InitialsAvatar';
import { sectionHeader } from '@/components/challenges/shared/format';
import type { SlotTeamMember } from '@/lib/flowSlots';

interface MLRepo {
  repo_id: string; repo_type: string; repo_external_id?: string;
  role: 'dataset' | 'model' | 'model_code' | 'api' | null;
  workspace_meta: { userUrls?: Record<string, string> };
}

interface MLWorkspace {
  currentUserId: string | null;
  repos: MLRepo[];
  users?: Record<string, { fullName: string; avatarUrl?: string }>;
}

// Grouped by role, not repo type: the model's GitHub and the API package are
// both typed 'github' and would otherwise collapse into one section.
const ML_STEP_CONFIG = [
  { key: 'dataset',    label: 'Dataset',     icon: Database },
  { key: 'model',      label: 'Model',       icon: Cpu },
  { key: 'model_code', label: 'Model Code',  icon: GitBranch },
  { key: 'api',        label: 'API Package', icon: Package },
];

/** Manager view of an ML challenge: every submission, by step. Reads the ML flow's `workspace` action. */
export function MlSubmissionsTab({ challengeId, team }: { challengeId: string; team: SlotTeamMember[] }) {
  const { data } = useQuery({
    queryKey: ['challenge-ml-workspace', challengeId],
    queryFn: () => fetchJson(flowActionUrl(challengeId, 'workspace')) as Promise<MLWorkspace>,
    enabled: !!challengeId,
  });
  const mlData = data ?? null;

  const teamUserMap = Object.fromEntries(team.map(m => [m.id, m.fullName]));
  const teamAvatarMap = Object.fromEntries(team.map(m => [m.id, m.avatarUrl]));
  const userMap = (uid: string) => mlData?.users?.[uid]?.fullName ?? teamUserMap[uid] ?? uid;
  const avatarMap = (uid: string) => mlData?.users?.[uid]?.avatarUrl ?? teamAvatarMap[uid];

  if (!mlData) return <p className="text-xs text-white/25">Loading…</p>;

  return (
    <div className="space-y-6">
      {ML_STEP_CONFIG.map(step => {
        const Icon = step.icon;
        const repos = mlData.repos.filter(r => r.role === step.key);
        if (repos.length === 0) return null;

        return (
          <div key={step.key} className="space-y-3">
            {sectionHeader(<Icon className="h-3.5 w-3.5" />, step.label)}
            {repos.map(repo => {
              const urls = Object.entries(repo.workspace_meta?.userUrls ?? {});
              return (
                <div key={repo.repo_id} className="rounded-[14px] border border-white/[0.06] bg-white/[0.02] divide-y divide-white/[0.04]">
                  {urls.length === 0 ? (
                    <p className="px-4 py-3 text-xs text-white/25">No submissions yet</p>
                  ) : urls.map(([uid, url]) => (
                    <div key={uid} className="flex items-center gap-3 px-4 py-3">
                      <div className="shrink-0">
                        <InitialsAvatar name={userMap(uid)} size={28} avatarUrl={avatarMap(uid)} />
                      </div>
                      <span className="text-sm text-white/60 flex-1">{userMap(uid)}</span>
                      <a href={url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 truncate max-w-xs text-xs text-brandCP hover:underline">
                        {url.replace(/^https?:\/\//, '')}
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
