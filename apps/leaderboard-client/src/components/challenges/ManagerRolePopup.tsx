'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Settings } from 'lucide-react';
import { challengeManagePath, challengePath } from '@/lib/paths';
import { vitrineFontVars } from '@/components/vitrine/fonts';

import '@/components/vitrine/vitrine.css';
import '@/components/vitrine/forms-vitrine.css';
import './challenge-overlays-vitrine.css';

interface ManagerRolePopupProps {
  x: number;
  y: number;
  /** Pour l'URL admin, qui reste sur l'UUID. */
  challengeId: string;
  /** Pour la page publique et la vue manager. */
  challengeSlug: string;
  onClose: () => void;
  /** Admins get the same choice, but the privileged view is the admin route. */
  isAdmin?: boolean;
}

/**
 * Le menu « ouvrir comme contributeur / comme manager », sous le curseur.
 * Monté hors de `.vitrine` par la page des challenges : il porte donc sa
 * propre racine `.vitrine-embed`.
 */
export function ManagerRolePopup({ x, y, challengeId, challengeSlug, onClose, isAdmin = false }: ManagerRolePopupProps) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div className={`vitrine-embed ${vitrineFontVars}`}>
      <div ref={ref} className="v-cp" style={{ top: y + 8, left: x }}>
        <button
          type="button"
          onClick={() => { onClose(); router.push(challengePath(challengeSlug)); }}
          className="v-cp-item"
        >
          <Users />
          Open as Contributor
        </button>
        <button
          type="button"
          onClick={() => { onClose(); router.push(isAdmin ? `/admin/challenges/${challengeId}` : challengeManagePath(challengeSlug)); }}
          className="v-cp-item"
          data-tone="manager"
        >
          <Settings />
          {isAdmin ? 'Open as Admin' : 'Open as Manager'}
        </button>
      </div>
    </div>
  );
}
