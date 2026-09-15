'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Check, Loader2, Users, X } from 'lucide-react';
import { challengePath } from '@/lib/paths';

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
 * Une `group_invite` porte un lien et deux raccourcis : accepter rejoint le
 * groupe sans passer par la page du challenge, refuser retire la ligne.
 *
 * **Refuser ne révoque rien.** Le jeton du groupe reste valide et le lien
 * partagé par ailleurs continue de marcher : sans état en attente, c'est un
 * classement sans suite. C'est aussi ce qui évite toute machine à états — la
 * notification reste un porteur de lien.
 *
 * Accepter appelle `POST /join { group }`, la route qu'emprunte déjà l'écran
 * d'invitation, avec ses quatre barrières. Aucune n'est réimplémentée ici : on
 * affiche le motif qu'elle renvoie.
 */
export function NotificationsTab() {
  const router = useRouter();
  const [items, setItems] = useState<NotificationView[]>([]);
  const [loading, setLoading] = useState(true);
  /** L'action en cours, par notification — pour ne verrouiller que sa ligne. */
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    fetch('/api/notifications')
      .then(r => (r.ok ? r.json() : { notifications: [] }))
      .then(data => { if (!cancelled) setItems(data.notifications ?? []); })
      .catch(() => { if (!cancelled) setItems([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const drop = (uuid: string) => setItems(prev => prev.filter(n => n.uuid !== uuid));

  const fail = (uuid: string, message: string) => {
    setErrors(prev => ({ ...prev, [uuid]: message }));
  };

  /** ✓ — rejoindre le groupe, puis atterrir sur le challenge. */
  const accept = async (item: NotificationView) => {
    const challengeId = String(item.payload.challengeId ?? '');
    const token = String(item.payload.groupToken ?? '');
    if (!challengeId || !token || busy) return;

    setBusy(item.uuid);
    setErrors(prev => ({ ...prev, [item.uuid]: '' }));
    try {
      const res = await fetch(`/api/challenges/${challengeId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group: token }),
      });

      if (!res.ok) {
        // Groupe plein, challenge fermé, déjà membre, déjà en solo : la route
        // sait le dire. La ligne reste, pour qu'on voie pourquoi.
        const payload = await res.json().catch(() => null);
        fail(item.uuid, payload?.error ?? 'Could not join this group.');
        return;
      }

      const data = await res.json().catch(() => ({}));
      if (data.missingGithub?.length) {
        alert(`${data.missingGithub.join(', ')} has no GitHub account connected and will not be able to push to the branch.`);
      }

      // L'invitation est consommée : la garder ferait revenir une ligne qui ne
      // mène plus nulle part. Non bloquant, la navigation prime.
      fetch(`/api/notifications/${item.uuid}`, { method: 'DELETE' }).catch(() => {});
      // Les invitations écrites avant les slugs n'ont que l'UUID : son URL
      // redirige vers le slug, le lien marche dans les deux cas.
      router.push(challengePath(String(item.payload.challengeSlug ?? challengeId)));
    } catch {
      fail(item.uuid, 'Network error.');
    } finally {
      setBusy(null);
    }
  };

  /** ✗ — retirer la notification. Ne révoque pas l'invitation. */
  const decline = async (item: NotificationView) => {
    if (busy) return;
    setBusy(item.uuid);
    setErrors(prev => ({ ...prev, [item.uuid]: '' }));
    try {
      const res = await fetch(`/api/notifications/${item.uuid}`, { method: 'DELETE' });
      if (!res.ok) { fail(item.uuid, 'Could not dismiss this invitation.'); return; }
      drop(item.uuid);
    } catch {
      fail(item.uuid, 'Network error.');
    } finally {
      setBusy(null);
    }
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
      {items.map(item => {
        const pending = busy === item.uuid;
        const error = errors[item.uuid];
        return (
          <div
            key={item.uuid}
            className={`rounded-xl border px-4 py-3 transition-colors ${
              item.read
                ? 'border-white/[0.06] bg-white/[0.02]'
                : 'border-brandCP/20 bg-brandCP/[0.04]'
            }`}
          >
            <div className="flex items-start gap-3">
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

              {/* Les deux ronds. Accepter est plein, refuser est un contour :
                  l'un est l'action offerte, l'autre la sortie. */}
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={() => accept(item)}
                  disabled={pending}
                  aria-label="Accept and join the group"
                  title="Join the group"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-brandCP transition-all duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {pending
                    ? <Loader2 className="h-4 w-4 animate-spin" style={{ color: '#fff' }} />
                    : <Check className="h-4 w-4" style={{ color: '#fff' }} />}
                </button>
                <button
                  onClick={() => decline(item)}
                  disabled={pending}
                  aria-label="Dismiss this invitation"
                  title="Dismiss"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 text-white/50 transition-all duration-200 hover:-translate-y-0.5 hover:border-white/30 hover:text-white/80 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {error && <p className="mt-2 pl-7 text-xs text-red-400">{error}</p>}
          </div>
        );
      })}
    </div>
  );
}
