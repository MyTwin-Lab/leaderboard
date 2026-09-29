'use client';

import { FolderGit2 } from 'lucide-react';
import { Modal } from '@/components/vitrine/Modal';

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
    <Modal open onClose={onClose} title={`Repo: ${repoTitle}`} icon={<FolderGit2 />} size="lg">
      <p className="v-help">Per-repo task workspaces are no longer tracked here.</p>
    </Modal>
  );
}
