"use client";

import Link from "next/link";

interface ContributorBadgeProps {
  fullName: string;
  githubUsername: string;
  role: string;
  avatarUrl?: string;
}

export function ContributorBadge({ fullName, avatarUrl }: ContributorBadgeProps) {
  const initials = fullName
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("");

  return (
    <Link
      href="/contributors/me"
      className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full ring-1 ring-[color:var(--n-line)] ring-offset-2 ring-offset-transparent transition hover:ring-[color:var(--n-accent,var(--theme-primary))]"
      aria-label="My profile"
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt={fullName} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-white/10 text-brandCP text-sm font-semibold">
          {initials}
        </div>
      )}
    </Link>
  );
}
