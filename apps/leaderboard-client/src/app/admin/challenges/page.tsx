'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ChallengeList } from '@/components/admin/ChallengeList';
import { CreateChallengeDrawer, type EditableChallenge } from '@/components/admin/CreateChallengeDrawer';
import { TeamModal } from '@/components/admin/TeamModal';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { Plus } from 'lucide-react';
import type { Challenge, Project } from '../../../../../../packages/database-service/domain/entities';

/** Le tiroir est fermé, ouvert en création, ou ouvert sur un challenge à éditer. */
type DrawerState = { open: false } | { open: true; challenge?: Challenge };

export default function ChallengesPage() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [drawer, setDrawer] = useState<DrawerState>({ open: false });
  const [teamModalChallenge, setTeamModalChallenge] = useState<Challenge | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const toast = useToast();
  const confirm = useConfirm();

  useEffect(() => { fetchChallenges(); fetchProjects(); }, []);

  const fetchChallenges = async () => {
    try {
      const res = await fetch('/api/challenges');
      setChallenges(await res.json());
    } catch { toast('Failed to load challenges', 'error'); }
    finally { setLoading(false); }
  };

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      setProjects(await res.json());
    } catch {}
  };

  // Le tiroir enregistre lui-même (POST à la création, PUT à l'édition) et
  // affiche ses propres erreurs : la page ne fait que recharger la liste.
  const handleSaved = async () => {
    const editing = drawer.open && !!drawer.challenge;
    setDrawer({ open: false });
    await fetchChallenges();
    toast(editing ? 'Challenge updated' : 'Challenge created', 'success');
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({ title: 'Delete Challenge', message: 'This will permanently delete the challenge and all associated data.', confirmLabel: 'Delete', variant: 'danger' });
    if (!ok) return;
    const res = await fetch(`/api/challenges/${id}`, { method: 'DELETE' });
    if (res.ok) { await fetchChallenges(); toast('Challenge deleted', 'success'); }
    else toast('Failed to delete challenge', 'error');
  };

  const handleClose = async (id: string) => {
    const ok = await confirm({ title: 'Close Challenge', message: 'This will mark the challenge as completed. This cannot be undone.', confirmLabel: 'Close', variant: 'danger' });
    if (!ok) return;
    setActionLoading(`close-${id}`);
    try {
      const res = await fetch(`/api/challenges/${id}/close`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) { toast('Challenge closed', 'success'); await fetchChallenges(); }
      else toast(data.error ?? 'Failed to close challenge', 'error');
    } finally { setActionLoading(null); }
  };

  if (loading) return <Skeleton />;

  return (
    <>
      <div className="animate-fade-up space-y-6">
        <Card action={
          <Button onClick={() => setDrawer({ open: true })}>
            <Plus className="h-3.5 w-3.5" /> New challenge
          </Button>
        }>
          <ChallengeList
            challenges={challenges}
            onEdit={challenge => setDrawer({ open: true, challenge })}
            onDelete={handleDelete}
            onTeam={c => setTeamModalChallenge(c)}
            onClose={handleClose}
            actionLoading={actionLoading}
          />
        </Card>
      </div>

      <CreateChallengeDrawer
        // Une clé par challenge : le formulaire repart de l'état du challenge ouvert.
        key={drawer.open ? drawer.challenge?.uuid ?? 'new' : 'closed'}
        open={drawer.open}
        onClose={() => setDrawer({ open: false })}
        projects={projects.map(p => ({ id: p.uuid, name: p.title }))}
        challenge={drawer.open ? (drawer.challenge as EditableChallenge | undefined) : undefined}
        onCreated={handleSaved}
      />

      {teamModalChallenge && (
        <TeamModal
          challengeId={teamModalChallenge.uuid}
          challengeTitle={teamModalChallenge.title}
          onClose={() => setTeamModalChallenge(null)}
        />
      )}
    </>
  );
}

function Skeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-10 w-48 rounded-xl bg-white/5" />
      {[...Array(4)].map((_, i) => <div key={i} className="h-14 rounded-xl bg-white/5" />)}
    </div>
  );
}
