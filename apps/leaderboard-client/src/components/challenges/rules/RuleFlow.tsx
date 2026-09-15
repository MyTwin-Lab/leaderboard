import type { ReactNode } from 'react';
import { ArrowDown } from 'lucide-react';

/** Primitives de mise en page des vues de règles (tiroir « Reward rules »). */

export const pct = (n: number) => Math.round(n * 100);

export function FlowArrow() {
  return (
    <div className="flex justify-center py-1">
      <ArrowDown className="h-4 w-4 text-white/20" />
    </div>
  );
}

export function FlowBox({
  icon, title, children, tone = 'default',
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  tone?: 'default' | 'warning';
}) {
  return (
    <div className={`rounded-xl border p-4 space-y-1.5 ${
      tone === 'warning'
        ? 'border-amber-500/25 bg-amber-500/[0.06]'
        : 'border-white/[0.08] bg-white/[0.03]'
    }`}>
      <div className="flex items-center gap-2">
        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
          tone === 'warning' ? 'bg-amber-500/15 text-amber-300' : 'bg-brandCP/10 text-brandCP'
        }`}>
          {icon}
        </div>
        <span className="text-sm font-semibold text-white">{title}</span>
      </div>
      <div className="pl-9 text-xs leading-relaxed text-white/55">{children}</div>
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-white/30">{children}</p>
  );
}
