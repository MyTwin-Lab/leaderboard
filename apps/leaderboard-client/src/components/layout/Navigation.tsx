"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Navigation() {
  const pathname = usePathname();

  const navItems = [
    { href: "/about", label: "About" },
    { href: "/", label: "Leaderboard" },
    { href: "/challenges", label: "Challenges" },
  ];

  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }
    return pathname.startsWith(href);
  };

  return (
    <div className="flex flex-1 items-center justify-center gap-18">
      {navItems.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`text-xl transition-all duration-300 ease-in-out ${
              active
                ? "font-semibold text-white scale-105"
                : "font-medium text-white/70 hover:text-white hover:scale-102"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
