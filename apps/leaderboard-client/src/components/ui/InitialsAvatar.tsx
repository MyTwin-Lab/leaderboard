"use client";

import { useMemo } from "react";

interface InitialsAvatarProps {
  name: string;
  size?: number;
  avatarUrl?: string;
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

export function InitialsAvatar({ name, size = 40, avatarUrl }: InitialsAvatarProps) {
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
        className="rounded-3xl object-cover"
        aria-hidden="true"
      />
    );
  }

  return (
    <div
      className="flex items-center justify-center rounded-3xl bg-brandCP/20 text-brandCP font-semibold"
      style={{ width: dimension, height: dimension, fontSize }}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}
