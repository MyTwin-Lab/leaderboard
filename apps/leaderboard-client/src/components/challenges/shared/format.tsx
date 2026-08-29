import type { ReactNode } from 'react';

/**
 * Date and section-header helpers shared by the challenge views.
 *
 * Lifted out of ChallengeManageView when ChallengeActivity was extracted:
 * both files need them, and duplicating a date formatter is how two views
 * start disagreeing on what "Mar 12" means.
 */
export function fmt(iso: string, opts?: Intl.DateTimeFormatOptions) {
  return new Date(iso).toLocaleDateString('en-US', opts ?? { month: 'short', day: 'numeric', year: 'numeric' });
}

export function sectionHeader(icon: ReactNode, label: string, count?: number) {
  return (
    <h3 className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-white/30">
      {icon}
      {label}
      {count !== undefined && (
        <span className="ml-auto rounded-full bg-white/8 px-2 py-0.5 text-[10px] font-normal normal-case tracking-normal text-white/40">{count}</span>
      )}
    </h3>
  );
}
