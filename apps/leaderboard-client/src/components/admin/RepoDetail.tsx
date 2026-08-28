'use client';

interface RepoDetailProps {
  repoId: string;
  repoTitle: string;
  onClose: () => void;
}

// NOTE: this used to list per-repo task workspaces (task_workspaces table).
// That table was removed with the personal-boards refactor — tasks no longer
// have a repo-scoped workspace, workspace state now lives on challenge_teams
// (per challenge + contributor). This modal is kept as a stub so callers
// still compile; a later task either repurposes or removes it.
export function RepoDetail({ repoTitle, onClose }: RepoDetailProps) {
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

        <p className="text-sm text-white/50">
          Per-repo task workspaces are no longer tracked here.
        </p>
      </div>
    </div>
  );
}
