"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

interface ContributorBadgeProps {
  fullName: string;
  githubUsername: string;
  role: string;
}

export function ContributorBadge({ fullName, githubUsername, role }: ContributorBadgeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setIsOpen((open) => !open)}
        className="cursor-pointer flex items-center gap-2 rounded-full bg-white/5 text-sm text-white shadow-md shadow-black/20 transition hover:bg-white/10"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-300 to-primary-200 text-s font-semibold text-slate-900">
          {fullName
            .split(" ")
            .map((part) => part[0])
            .slice(0, 2)
            .join("")}
        </div>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-12 z-50 w-56 rounded-xl border border-white/10 bg-slate-900/90 p-3 text-sm text-white shadow-lg shadow-black/30">
          <p className="font-semibold">{fullName}</p>
          <p className="text-white/60">@{githubUsername}</p>
          <div className="mt-4 flex flex-col gap-2">
            <Link
              href="/contributors/me"
              className="rounded-full border border-white/10 px-3 py-2 text-center text-white/80 transition hover:bg-white/5"
              onClick={() => setIsOpen(false)}
            >
              View my profile
            </Link>
            {role === 'admin' && (
              <Link
                href="/admin"
                className="rounded-full border border-brandCP/30 bg-brandCP/10 px-3 py-2 text-center text-brandCP transition hover:bg-brandCP/20"
                onClick={() => setIsOpen(false)}
              >
                Admin Dashboard
              </Link>
            )}
            <button
              onClick={async () => {
                await fetch("/api/auth/logout", { method: "POST" });
                window.location.href = "/";
              }}
              className="cursor-pointer rounded-full border border-red-500/20 bg-red-500/10 px-3 py-2 text-center text-red-300 transition hover:bg-red-500/20"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
