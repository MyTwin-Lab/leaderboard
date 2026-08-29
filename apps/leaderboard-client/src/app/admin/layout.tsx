'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { ToastProvider } from '@/components/ui/Toast';
import { ConfirmDialogProvider } from '@/components/ui/ConfirmDialog';
import { LogOut } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/admin',             label: 'Overview',      exact: true },
  { href: '/admin/challenges',  label: 'Challenges' },
  { href: '/admin/projects',    label: 'Projects' },
  { href: '/admin/repos',       label: 'Repos' },
  { href: '/admin/users',       label: 'Users' },
  { href: '/admin/contributions', label: 'Contributions' },
  { href: '/admin/evaluation-grids', label: 'Grids' },
  { href: '/admin/evaluation-runs',  label: 'Runs' },
  { href: '/admin/meetings',    label: 'Meetings' },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const isChallengeDetail = /^\/admin\/challenges\/[^/]+$/.test(pathname);

  const isActive = (item: typeof NAV_ITEMS[0]) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
    router.refresh();
  };

  return (
    <ToastProvider>
      <ConfirmDialogProvider>
        <div className="min-h-screen">

          {/* ── Nav ── */}
          {!isChallengeDetail && (
            <header className="sticky top-0 z-40 border-b border-white/[0.07] backdrop-blur-md">
              <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 sm:px-6">

                {/* Admin pill */}
                <span className="shrink-0 rounded-full border border-brandCP/25 bg-brandCP/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-brandCP">
                  Admin
                </span>

                {/* Nav links — scrollable on mobile */}
                <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
                  {NAV_ITEMS.map(item => {
                    const active = isActive(item);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`group relative shrink-0 px-3 py-3 text-sm font-medium transition-all duration-200 focus-visible:outline-none ${
                          active ? 'text-white' : 'text-white/40 hover:text-white/70'
                        }`}
                      >
                        {item.label}
                        <span className={`absolute bottom-0 left-0 right-0 h-[2px] origin-left rounded-full bg-brandCP transition-transform duration-200 ${
                          active ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-50'
                        }`} />
                      </Link>
                    );
                  })}
                </nav>

                {/* Logout */}
                <button
                  onClick={handleLogout}
                  className="shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-white/30 transition-colors hover:bg-white/[0.05] hover:text-white/60"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Logout
                </button>
              </div>
            </header>
          )}

          {/* ── Content ── */}
          <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
            {children}
          </main>

        </div>
      </ConfirmDialogProvider>
    </ToastProvider>
  );
}
