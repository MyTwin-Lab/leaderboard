"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface InitialsAvatarProps {
  name: string;
  size?: number;
  avatarUrl?: string;
  /** Appended (via tailwind-merge) on top of the default look — lets a
   * specific usage (e.g. TeamAvatars on the challenge card) override the
   * radius/background without changing every other InitialsAvatar caller. */
  className?: string;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("")
    .padEnd(2, "?");
}

export function InitialsAvatar({ name, size = 40, avatarUrl, className }: InitialsAvatarProps) {
  const initials = useMemo(() => getInitials(name), [name]);
  const dimension = `${size}px`;
  const fontSize = `${Math.round(size * 0.35)}px`;

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={name}
        style={{ width: dimension, height: dimension }}
        className={cn("rounded-3xl object-cover", className)}
        aria-hidden="true"
      />
    );
  }

  return (
    <div
      className={cn("flex items-center justify-center rounded-3xl bg-brandCP/20 text-brandCP font-semibold", className)}
      style={{ width: dimension, height: dimension, fontSize }}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}
