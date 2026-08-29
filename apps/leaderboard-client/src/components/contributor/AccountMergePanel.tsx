'use client';

import { useState } from 'react';
import { Link2, Check, X } from 'lucide-react';
import { InitialsAvatar } from '@/components/ui/InitialsAvatar';
import { SelectDropdown } from '@/components/ui/SelectDropdown';
import { Button } from '@/components/ui/Button';
import { ToastProvider, useToast } from '@/components/ui/Toast';
import { ConfirmDialogProvider, useConfirm } from '@/components/ui/ConfirmDialog';
import type { User } from '@packages/database-service/domain/entities';

interface Props {
  unlinkedUsers: User[];
  linkedUsers: User[];
}

// Le sous-arbre de /contributors/me ne monte pas ToastProvider/ConfirmDialogProvider
// (seul apps/leaderboard-client/src/app/admin/layout.tsx le fait) — même convention
// que EvaluationGridsTab.tsx : ce panneau apporte les siens.
export function AccountMergePanel(props: Props) {
  return (
    <ToastProvider>
      <ConfirmDialogProvider>
        <AccountMergePanelInner {...props} />
      </ConfirmDialogProvider>
    </ToastProvider>
  );
}

function AccountMergePanelInner({ unlinkedUsers, linkedUsers }: Props) {
  const [unlinked, setUnlinked] = useState(unlinkedUsers);
  const [linked, setLinked] = useState(linkedUsers);
  const [openFor, setOpenFor] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [merging, setMerging] = useState<string | null>(null);

  const toast = useToast();
  const confirm = useConfirm();

  if (unlinked.length === 0) return null;

  const handleMerge = async (placeholder: User) => {
    const googleAccountId = selected[placeholder.uuid];
    const googleAccount = linked.find((u) => u.uuid === googleAccountId);
    if (!googleAccount) return;

    const ok = await confirm({
      title: 'Fusionner les comptes',
      message: `Le Google de "${googleAccount.full_name}" (${googleAccount.email ?? '—'}) sera transféré vers "${placeholder.full_name}", puis le compte "${googleAccount.full_name}" sera supprimé. S'il est connecté, il devra se reconnecter à sa prochaine action.`,
      confirmLabel: 'Fusionner',
      variant: 'danger',
    });
    if (!ok) return;

    setMerging(placeholder.uuid);
    try {
      const res = await fetch('/api/users/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ placeholderId: placeholder.uuid, googleAccountId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? 'Merge failed');
      }
      setUnlinked((prev) => prev.filter((u) => u.uuid !== placeholder.uuid));
      setLinked((prev) => prev.filter((u) => u.uuid !== googleAccountId));
      setOpenFor(null);
      toast('Comptes fusionnés', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Merge failed', 'error');
    } finally {
      setMerging(null);
    }
  };

  return (
    <div className="mt-8 space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-white/30">
        Comptes sans Google ({unlinked.length})
      </h3>
      <div className="divide-y divide-white/[0.04]">
        {unlinked.map((u) => (
          <div key={u.uuid} className="flex flex-wrap items-center gap-3 py-3">
            <InitialsAvatar name={u.full_name} size={28} avatarUrl={u.avatar_url ?? undefined} />
            <span className="text-sm text-white/80">{u.full_name}</span>

            {openFor === u.uuid ? (
              <div className="flex flex-1 flex-wrap items-center gap-2 sm:justify-end">
                <SelectDropdown
                  className="w-64"
                  placeholder="Choisir le compte Google…"
                  value={selected[u.uuid] ?? ''}
                  onChange={(value) => setSelected((prev) => ({ ...prev, [u.uuid]: value }))}
                  options={linked.map((l) => ({ value: l.uuid, label: `${l.full_name} (${l.email ?? '—'})` }))}
                />
                <Button
                  size="sm"
                  disabled={!selected[u.uuid] || merging === u.uuid}
                  onClick={() => handleMerge(u)}
                >
                  <Check className="h-3.5 w-3.5" />
                  Confirmer
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setOpenFor(null)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="secondary" className="ml-auto" onClick={() => setOpenFor(u.uuid)}>
                <Link2 className="h-3.5 w-3.5" />
                Lier
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
