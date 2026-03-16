"use client";

import Link from "next/link";
import { useRef } from "react";

interface ContributorBadgeProps {
  fullName: string;
  githubUsername: string;
  role: string;
}

export function ContributorBadge({ fullName, githubUsername, role }: ContributorBadgeProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={containerRef} className="relative">
      <Link
        href="/contributors/me"
        className="cursor-pointer flex items-center gap-2 rounded-full text-sm text-white transition"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-brandCP text-s font-semibold hover:bg-white/15">
          {fullName
            .split(" ")
            .map((part) => part[0])
            .slice(0, 2)
            .join("")}
        </div>
      </Link>
    </div>
  );
}
