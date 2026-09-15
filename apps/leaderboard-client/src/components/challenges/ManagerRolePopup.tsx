'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Settings } from 'lucide-react';
import { challengeManagePath, challengePath } from '@/lib/paths';

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
    <div
      ref={ref}
      style={{ position: 'fixed', top: y + 8, left: x, zIndex: 9999 }}
      className="w-52 rounded-xl border border-white/10 bg-background p-1.5 shadow-2xl"
    >
      <button
        onClick={() => { onClose(); router.push(challengePath(challengeSlug)); }}
        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-white/70 transition-colors hover:bg-white/[0.05] hover:text-white"
      >
        <Users className="h-4 w-4 shrink-0 text-white/40" />
        Open as Contributor
      </button>
      <button
        onClick={() => { onClose(); router.push(isAdmin ? `/admin/challenges/${challengeId}` : challengeManagePath(challengeSlug)); }}
        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-purple-400 transition-colors hover:bg-purple-500/[0.08] hover:text-purple-300"
      >
        <Settings className="h-4 w-4 shrink-0 text-purple-400/70" />
        {isAdmin ? 'Open as Admin' : 'Open as Manager'}
      </button>
    </div>
  );
}
