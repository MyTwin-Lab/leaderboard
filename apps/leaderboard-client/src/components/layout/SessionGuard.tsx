'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';

/**
 * Détecte, sur n'importe quel fetch (appel API applicatif ou navigation RSC
 * next/link), qu'un admin a fusionné ou supprimé le compte connecté
 * (proxy.ts renvoie alors 401 SESSION_INVALID au lieu de laisser passer le
 * JWT encore valide par signature). Affiche une modale de reconnexion plutôt
 * que de laisser l'utilisateur continuer à agir sur un compte qui n'existe
 * plus.
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="w-full max-w-sm space-y-4 rounded-xl border border-white/10 bg-background p-6 text-center shadow-2xl">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10">
          <AlertTriangle className="h-5 w-5 text-amber-400" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-white">Session expirée</h3>
          <p className="mt-1 text-sm text-white/60">
            Ton compte a été mis à jour, merci de te reconnecter pour continuer.
          </p>
        </div>
        <Button className="w-full" onClick={() => { window.location.href = reconnectUrl; }}>
          Se reconnecter
        </Button>
      </div>
    </div>
  );
}
