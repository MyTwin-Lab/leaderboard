'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Users } from 'lucide-react';

interface NotificationView {
  uuid: string;
  type: string;
  payload: Record<string, unknown>;
  read: boolean;
  created_at: string | null;
}

/**
 * Les notifications du contributeur.
 *
 * Une notification `group_invite` transporte un lien, et rien d'autre : il n'y
 * a ni acceptation ni refus. Cliquer mène à `/challenges/:id?group=<token>`,
 * c'est-à-dire au parcours d'invitation existant, avec ses gardes.
 *
 * Rien n'est écrit ici pour la péremption : une invitation devenue caduque
 * atterrit sur l'écran de barrière que `GET /group/:token` produit déjà, avec
 * ses quatre motifs. La notification n'a pas besoin de savoir que le groupe
 * s'est rempli — la page vers laquelle elle pointe, si.
 */
export function NotificationsTab() {
  const router = useRouter();
  const [items, setItems] = useState<NotificationView[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/notifications')
      .then(r => (r.ok ? r.json() : { notifications: [] }))
      .then(data => { if (!cancelled) setItems(data.notifications ?? []); })
      .catch(() => { if (!cancelled) setItems([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const open = (item: NotificationView) => {
    const challengeId = String(item.payload.challengeId ?? '');
    const token = String(item.payload.groupToken ?? '');
    if (!challengeId || !token) return;
    // Marquage non bloquant : la navigation compte plus que la pastille, et
    // l'échec du PATCH ne doit pas retenir le clic.
    fetch(`/api/notifications/${item.uuid}`, { method: 'PATCH' }).catch(() => {});
    setItems(prev => prev.map(n => (n.uuid === item.uuid ? { ...n, read: true } : n)));
    router.push(`/challenges/${challengeId}?group=${token}`);
  };

  if (loading) {
    return <p className="py-8 text-center text-xs text-white/30">Loading…</p>;
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-6 py-10 text-center">
        <Bell className="h-5 w-5 text-white/20" />
        <p className="text-sm text-white/40">Nothing here yet.</p>
        <p className="text-xs text-white/25">
          Group invitations from other contributors will show up here.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-2 py-2">
      {items.map(item => (
        <button
          key={item.uuid}
          onClick={() => open(item)}
          className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
            item.read
              ? 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]'
              : 'border-brandCP/20 bg-brandCP/[0.04] hover:bg-brandCP/[0.07]'
          }`}
        >
          <Users className="mt-0.5 h-4 w-4 shrink-0 text-brandCP/70" />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-white/85">
              <span className="font-semibold">
                {String(item.payload.fromName ?? 'A contributor')}
              </span>
              {' invited you to their group on '}
              <span className="font-semibold">
                {String(item.payload.challengeTitle ?? 'a challenge')}
              </span>
            </p>
            {item.created_at && (
              <p className="mt-0.5 text-[11px] text-white/25">
                {new Date(item.created_at).toLocaleDateString('en-US', {
                  day: 'numeric', month: 'long', year: 'numeric',
                })}
              </p>
            )}
          </div>
          {!item.read && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brandCP" />}
        </button>
      ))}
    </div>
  );
}
