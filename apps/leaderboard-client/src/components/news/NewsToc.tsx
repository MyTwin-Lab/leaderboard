"use client";

import { useMemo } from "react";
import { formatIndex } from "@/content/news/format";
import { useScrollSpy } from "@/lib/useScrollSpy";

export type TocItem = { id: string; title: string };

/**
 * Le sommaire collant de la marge, d'après la maquette : un numéro, un titre,
 * et la section en vue sur un fond menthe.
 *
 * Sous 900px il n'y a plus de marge où coller : le sommaire replié de
 * `NewsArticleBody` prend le relais, en `<details>` natif et sans JS.
 */
export function NewsToc({ items }: { items: TocItem[] }) {
  const ids = useMemo(() => items.map((item) => item.id), [items]);
  const { active, select } = useScrollSpy(ids);

  return (
    <nav aria-label="Contents" className="v-nd-toc-nav">
      <span className="v-nd-toc-label">Contents</span>
      <ol className="v-nd-toc-list">
        {items.map((item, index) => {
          const isActive = active === item.id;
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                aria-current={isActive ? "location" : undefined}
                data-on={isActive}
                className="v-nd-toc-link"
                onClick={(event) => {
                  event.preventDefault();
                  select(item.id);
                  // L'ancre reste partageable même si le défilement est animé à la main.
                  window.history.replaceState(null, "", `#${item.id}`);
                }}
              >
                <span className="v-nd-toc-num">{formatIndex(index)}</span>
                <span className="v-nd-toc-title">{item.title}</span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
