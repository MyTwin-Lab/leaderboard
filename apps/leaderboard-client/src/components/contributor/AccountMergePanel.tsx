'use client';

import { useState } from 'react';
import { Link2, Check, X } from 'lucide-react';
import { VitrineAvatar } from '@/components/vitrine/VitrineAvatar';
import { SelectDropdown } from '@/components/ui/SelectDropdown';
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
      message: `Le Google de "${googleAccount.full_name}" (${googleAccount.email ?? '-'}) sera transféré vers "${placeholder.full_name}", puis le compte "${googleAccount.full_name}" sera supprimé. S'il est connecté, il devra se reconnecter à sa prochaine action.`,
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
    <>
      {/* La maquette range la fusion sur la carte teintée, sous la table : c'est
          le geste d'exception de l'onglet, pas sa matière courante. */}
      <div className="v-pro-switch-row" data-tone="mint" style={{ alignItems: "flex-start" }}>
        <div className="v-pro-switch-text" style={{ flex: "1 1 16rem" }}>
          <span className="v-pro-switch-label">Merge an unlinked account ({unlinked.length})</span>
          <span className="v-pro-switch-desc">
            A contributor created before Google sign-in keeps their CP when merged into a linked
            account.
          </span>
        </div>
      </div>

      <div className="v-pro-rows">
        {unlinked.map((u) => (
          <div key={u.uuid} className="v-pro-row" style={{ padding: "0.7rem 1rem" }}>
            <div className="v-pro-merge-row">
              <VitrineAvatar name={u.full_name} avatarUrl={u.avatar_url ?? undefined} size="1.75rem" ring={false} />
              <span className="v-pro-row-title">{u.full_name}</span>

              {openFor === u.uuid ? (
                <div className="v-pro-merge-actions">
                  <SelectDropdown
                    className="w-64"
                    placeholder="Choisir le compte Google…"
                    value={selected[u.uuid] ?? ''}
                    onChange={(value) => setSelected((prev) => ({ ...prev, [u.uuid]: value }))}
                    options={linked.map((l) => ({ value: l.uuid, label: `${l.full_name} (${l.email ?? '-'})` }))}
                  />
                  <button
                    className="v-pro-btn"
                    disabled={!selected[u.uuid] || merging === u.uuid}
                    onClick={() => handleMerge(u)}
                  >
                    <Check />
                    Confirmer
                  </button>
                  <button className="v-pro-btn-quiet" onClick={() => setOpenFor(null)}>
                    <X />
                  </button>
                </div>
              ) : (
                <button className="v-pro-btn-quiet" style={{ marginLeft: "auto" }} onClick={() => setOpenFor(u.uuid)}>
                  <Link2 />
                  Lier
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
