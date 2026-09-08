'use client';

import { Loader2, UserPlus } from 'lucide-react';

/**
 * Le bouton pour rejoindre un challenge — pilule pleine, comme la maquette.
 * Partagé entre le brief (qui l'affiche centré, seul appel à l'action de la
 * page) et le teaser du panneau code (challenge sans brief).
 */
export function JoinButton({
  onClick, joining, className = '', variant = 'primary', icon, label = 'Join',
}: {
  onClick: () => void;
  joining: boolean;
  className?: string;
  /** 'secondary' = contour, pour l'action de groupe posée à côté du join solo. */
  variant?: 'primary' | 'secondary';
  icon?: React.ReactNode;
  label?: string;
}) {
  const secondary = variant === 'secondary';
  const skin = secondary
    ? 'border border-white/15 text-white/70 hover:border-brandCP/45 hover:text-white'
    : 'bg-brandCP hover:bg-brandCP/90 hover:shadow-[0_4px_20px_rgba(10,247,193,0.2)]';

  return (
    <button
      onClick={onClick}
      disabled={joining}
      style={secondary ? undefined : { color: '#fff' }}
      className={`flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60 ${skin} ${className}`}
    >
      {joining
        ? <Loader2 className="h-4 w-4 animate-spin" style={secondary ? undefined : { color: '#fff' }} />
        : icon ?? <UserPlus className="h-4 w-4" style={{ color: '#fff' }} />}
      {label}
    </button>
  );
}
