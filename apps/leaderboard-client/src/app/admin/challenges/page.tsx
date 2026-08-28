'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ContributorTabs } from '@/components/contributor/ContributorTabs';
import { ChallengeList } from '@/components/admin/ChallengeList';
import { ChallengeForm } from '@/components/admin/ChallengeForm';
import { TeamModal } from '@/components/admin/TeamModal';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { Plus } from 'lucide-react';
import type { Challenge, Project } from '../../../../../../packages/database-service/domain/entities';

export default function ChallengesPage() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [editingChallenge, setEditingChallenge] = useState<Challenge | undefined>();
  const [teamModalChallenge, setTeamModalChallenge] = useState<Challenge | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);

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

  const handleCreate = async (data: any) => {
    const res = await fetch('/api/challenges', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    if (res.ok) { await fetchChallenges(); setActiveTab(0); toast('Challenge created', 'success'); }
    else toast('Failed to create challenge', 'error');
  };

  const handleUpdate = async (data: any) => {
    if (!editingChallenge) return;
    const res = await fetch(`/api/challenges/${editingChallenge.uuid}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    if (res.ok) { await fetchChallenges(); setEditingChallenge(undefined); setActiveTab(0); toast('Challenge updated', 'success'); }
    else toast('Failed to update challenge', 'error');
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({ title: 'Delete Challenge', message: 'This will permanently delete the challenge and all associated data.', confirmLabel: 'Delete', variant: 'danger' });
    if (!ok) return;
    const res = await fetch(`/api/challenges/${id}`, { method: 'DELETE' });
    if (res.ok) { await fetchChallenges(); toast('Challenge deleted', 'success'); }
    else toast('Failed to delete challenge', 'error');
  };

  const handleEdit = (challenge: Challenge) => { setEditingChallenge(challenge); setActiveTab(1); };

  const handleSync = async (id: string) => {
    const ok = await confirm({ title: 'Run Sync Evaluation', message: 'This will run the Sync Meeting evaluation for all participants.', confirmLabel: 'Run Sync' });
    if (!ok) return;
    setActionLoading(`sync-${id}`);
    try {
      const res = await fetch(`/api/challenges/${id}/sync`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) toast(`${data.count} evaluations completed`, 'success');
      else toast(data.error ?? 'Sync failed', 'error');
    } finally { setActionLoading(null); }
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
        <ControlledTabs active={activeTab} onChange={setActiveTab} tabs={[
          {
            label: 'Challenges',
            count: challenges.length,
            panel: (
              <Card action={
                <Button onClick={() => { setEditingChallenge(undefined); setActiveTab(1); }}>
                  <Plus className="h-3.5 w-3.5" /> New challenge
                </Button>
              }>
                <ChallengeList
                  challenges={challenges}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onTeam={c => setTeamModalChallenge(c)}
                  onSync={handleSync}
                  onClose={handleClose}
                  actionLoading={actionLoading}
                />
              </Card>
            ),
          },
          {
            label: editingChallenge ? 'Edit Challenge' : 'New Challenge',
            panel: (
              <Card title={editingChallenge ? `Edit — ${editingChallenge.title}` : 'New Challenge'}>
                <ChallengeForm
                  challenge={editingChallenge}
                  projects={projects}
                  onSubmit={editingChallenge ? handleUpdate : handleCreate}
                  onCancel={() => { setEditingChallenge(undefined); setActiveTab(0); }}
                />
              </Card>
            ),
          },
        ]} />
      </div>

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

/* ── Controlled tabs (same style as ContributorTabs but externally controlled) ── */
function ControlledTabs({ tabs, active, onChange }: {
  tabs: { label: string; count?: number; panel: React.ReactNode }[];
  active: number;
  onChange: (i: number) => void;
}) {
  return (
    <div>
      <div className="mb-6 flex overflow-x-auto border-b border-white/10">
        {tabs.map((tab, i) => (
          <button
            key={i}
            onClick={() => onChange(i)}
            className={`group relative shrink-0 px-4 py-2.5 font-medium transition-all duration-200 focus-visible:outline-none ${
              active === i ? 'text-[15px] text-white' : 'text-[13px] text-white/40 hover:text-white/70'
            }`}
          >
            <span className="flex items-center gap-2">
              {tab.label}
              {tab.count !== undefined && (
                <span className="rounded-full bg-white/8 px-2 py-0.5 text-[10px] font-normal text-white/40">{tab.count}</span>
              )}
            </span>
            <span className={`absolute bottom-0 left-0 right-0 h-[2px] origin-left rounded-full bg-brandCP transition-transform duration-200 ${
              active === i ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-50'
            }`} />
          </button>
        ))}
      </div>
      <div key={active} className="animate-fade-up">{tabs[active].panel}</div>
    </div>
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
