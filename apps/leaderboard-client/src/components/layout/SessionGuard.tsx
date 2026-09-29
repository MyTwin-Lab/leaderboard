'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { Modal } from '@/components/vitrine/Modal';

/**
 * Détecte, sur n'importe quel fetch (appel API applicatif ou navigation RSC
 * next/link), qu'un admin a fusionné ou supprimé le compte connecté
 * (proxy.ts renvoie alors 401 SESSION_INVALID au lieu de laisser passer le
 * JWT encore valide par signature). Affiche une modale de reconnexion plutôt
 * que de laisser l'utilisateur continuer à agir sur un compte qui n'existe
 * plus.
 *
 * Sur la modale vitrine, sans fermeture possible : la seule sortie est la
 * reconnexion.
 */
export function SessionGuard() {
  const [invalid, setInvalid] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const originalFetch = window.fetch;

    window.fetch = (async (...args: Parameters<typeof fetch>) => {
      const response = await originalFetch(...args);
      if (response.status === 401) {
        try {
          const body = await response.clone().json();
          if (body?.error === 'SESSION_INVALID') setInvalid(true);
        } catch {
          // 401 non-JSON — hors périmètre de ce guard
        }
      }
      return response;
    }) as typeof fetch;

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  if (!invalid) return null;

  const reconnectUrl = `/api/google-auth/authorize?from=${encodeURIComponent(pathname || '/')}`;

  return (
    <Modal
      open
      onClose={() => {}}
      title="Session expirée"
      subtitle="Ton compte a été mis à jour, merci de te reconnecter pour continuer."
      icon={<AlertTriangle />}
      size="sm"
      center
      above
    >
      <button
        type="button"
        className="v-btn"
        data-tone="accent"
        style={{ width: '100%' }}
        onClick={() => { window.location.href = reconnectUrl; }}
      >
        Se reconnecter
      </button>
    </Modal>
  );
}
