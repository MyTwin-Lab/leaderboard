'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  const navItems = [
    { href: '/admin', label: 'Overview' },
    { href: '/admin/challenges', label: 'Challenges' },
    { href: '/admin/projects', label: 'Projects' },
    { href: '/admin/repos', label: 'Repos' },
    { href: '/admin/users', label: 'Users' },
    { href: '/admin/contributions', label: 'Contributions' },
  ];

  return (
    <div className="min-h-screen">
      {/* Header avec navigation */}
      <header className="shadow-md rounded-md bg-white/5 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex h-16 items-center justify-between">
            {/* Logo + Title */}
            <div className="flex items-center gap-6">
              <h1 className="text-lg font-semibold text-white">Admin Dashboard</h1>
            </div>

            {/* Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-primary-300/20 text-primary-100'
                        : 'text-white/70 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-7xl px-6 py-8">
        {children}
      </main>
    </div>
  );
}
