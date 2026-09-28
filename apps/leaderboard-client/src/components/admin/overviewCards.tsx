import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * Les cartes de l'accueil admin (`app/admin/page.tsx`), partagées avec les
 * slots des modules qui y ajoutent un chiffre ou un onglet.
 */

export function StatCard({ label, value, loading, icon }: { label: string; value: number; loading: boolean; icon: ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-white/25">{label}</span>
        <span className="text-primary-100/30">{icon}</span>
      </div>
      <div className="text-3xl font-bold text-white">
        {loading ? <span className="inline-block h-8 w-12 animate-pulse rounded-lg bg-white/10" /> : value}
      </div>
    </div>
  );
}

export function SectionHeader({ title, href }: { title: string; href: string }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h3 className="text-[10px] font-semibold uppercase tracking-widest text-white/30">{title}</h3>
      <Link href={href} className="text-xs text-white/30 transition-colors hover:text-brandCP">View all →</Link>
    </div>
  );
}

export function Empty({ label }: { label: string }) {
  return <p className="py-8 text-center text-xs text-white/25">{label}</p>;
}
