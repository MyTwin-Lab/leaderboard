'use client';

import { Loader2, UserPlus } from 'lucide-react';

/**
 * Le bouton pour rejoindre un challenge — pilule pleine, comme la maquette.
 * Partagé entre le brief (qui l'affiche centré, seul appel à l'action de la
 * page) et le teaser du panneau code (challenge sans brief).
 */
export function JoinButton({
  onClick, joining, className = '',
}: {
  onClick: () => void;
  joining: boolean;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={joining}
      style={{ color: '#fff' }}
      className={`flex items-center gap-2 rounded-full bg-brandCP px-6 py-3 text-sm font-semibold transition-all duration-200 hover:bg-brandCP/90 hover:shadow-[0_4px_20px_rgba(10,247,193,0.2)] disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {joining
        ? <Loader2 className="h-4 w-4 animate-spin" style={{ color: '#fff' }} />
        : <UserPlus className="h-4 w-4" style={{ color: '#fff' }} />}
      Join
    </button>
  );
}
