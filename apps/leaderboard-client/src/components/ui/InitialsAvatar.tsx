"use client";

import { useMemo } from "react";

interface InitialsAvatarProps {
  name: string;
  size?: number;
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

export function InitialsAvatar({ name, size = 40 }: InitialsAvatarProps) {
  const initials = useMemo(() => getInitials(name), [name]);
  const dimension = `${size}px`;

  return (
    <div
      className="flex items-center justify-center rounded-3xl bg-primary-300/20 text-primary-200 font-semibold"
      style={{ width: dimension, height: dimension }}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}
