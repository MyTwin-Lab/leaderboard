'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { challengePath } from '@/lib/paths';
import { VitrineAvatar } from '@/components/vitrine/VitrineAvatar';

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
    return <p className="v-pro-note" style={{ padding: '2rem 0', textAlign: 'center' }}>Loading…</p>;
  }

  if (items.length === 0) {
    return (
      <div className="v-pro-empty">
        <span className="v-pro-empty-title">Nothing waiting for you</span>
        <span className="v-pro-empty-sub">Group invitations show up here.</span>
      </div>
    );
  }

  return (
    <>
      <span className="v-pro-kicker">Group invitations</span>
      {items.map(item => {
        const pending = busy === item.uuid;
        const error = errors[item.uuid];
        const from = String(item.payload.fromName ?? 'A contributor');
        return (
          <div key={item.uuid} className="v-pro-invite">
            <VitrineAvatar name={from} size="2.25rem" ring={false} />

            <div className="v-pro-invite-text">
              <span className="v-pro-invite-title">{from} invited you to their group</span>
              <span className="v-pro-invite-sub">
                {String(item.payload.challengeTitle ?? 'a challenge')}
                {' · you would share their board, branch and contribution.'}
              </span>
              {error && <span className="v-pro-error">{error}</span>}
            </div>

            {/* Accepter est plein, refuser est du texte : l'un est l'action
                offerte, l'autre la sortie. */}
            <div className="v-pro-invite-actions">
              <button
                onClick={() => accept(item)}
                disabled={pending}
                aria-label="Accept and join the group"
                className="v-pro-btn"
              >
                {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Accept
              </button>
              <button
                onClick={() => decline(item)}
                disabled={pending}
                aria-label="Dismiss this invitation"
                className="v-pro-btn-text"
              >
                Decline
              </button>
            </div>
          </div>
        );
      })}
    </>
  );
}
