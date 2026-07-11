'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Settings } from 'lucide-react';

interface ManagerRolePopupProps {
  x: number;
  y: number;
  challengeId: string;
  onClose: () => void;
}

export function ManagerRolePopup({ x, y, challengeId, onClose }: ManagerRolePopupProps) {
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
      className="w-52 rounded-xl border border-white/10 bg-[#0d1117] p-1.5 shadow-2xl"
    >
      <button
        onClick={() => { onClose(); router.push(`/challenges/${challengeId}`); }}
        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-white/70 transition-colors hover:bg-white/[0.05] hover:text-white"
      >
        <Users className="h-4 w-4 shrink-0 text-white/40" />
        Open as Contributor
      </button>
      <button
        onClick={() => { onClose(); router.push(`/challenges/${challengeId}/manage`); }}
        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-purple-400 transition-colors hover:bg-purple-500/[0.08] hover:text-purple-300"
      >
        <Settings className="h-4 w-4 shrink-0 text-purple-400/70" />
        Open as Manager
      </button>
    </div>
  );
}
