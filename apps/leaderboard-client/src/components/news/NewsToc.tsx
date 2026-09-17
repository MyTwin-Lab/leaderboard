"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useScrollSpy } from "@/lib/useScrollSpy";

export type TocItem = { id: string; title: string };

export function NewsToc({ items }: { items: TocItem[] }) {
  const ids = useMemo(() => items.map((item) => item.id), [items]);
  const { active, select } = useScrollSpy(ids);

  return (
    <nav aria-label="Contents">
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/45">Contents</p>
      <ol className="mt-4 flex flex-col border-l border-white/10">
        {items.map((item) => {
          const isActive = active === item.id;
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                aria-current={isActive ? "location" : undefined}
                onClick={(event) => {
                  event.preventDefault();
                  select(item.id);
                  // L'ancre reste partageable même si le défilement est animé à la main.
                  window.history.replaceState(null, "", `#${item.id}`);
                }}
                // L'inactif s'estompe par l'opacité et non par `text-white/55` :
                // en mode clair, globals.css force toute teinte `text-white*` à
                // la couleur pleine du texte, et les deux états se confondraient.
                className={cn(
                  "-ml-px block border-l-2 py-2 pl-4 text-sm leading-snug text-white transition-all duration-200",
                  isActive ? "border-brandCP font-medium" : "border-transparent opacity-55 hover:opacity-100",
                )}
              >
                {item.title}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
