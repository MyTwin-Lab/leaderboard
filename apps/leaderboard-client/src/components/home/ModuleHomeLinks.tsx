"use client";

import Link from "next/link";
import { useModuleSlots } from "@/distribution/mytwin.modules";
import { ArrowIcon } from "./ArrowIcon";

/**
 * Les liens d'accueil des modules actifs (« Open resources » du module
 * watch), pour le hero, composant serveur. L'état des modules est dans le
 * cache dès le rendu serveur (`app/layout.tsx`) : le lien est dans le HTML
 * initial, et absent quand son module est désactivé.
 */
export function ModuleHomeLinks() {
  const { slots } = useModuleSlots();
  return (
    <>
      {slots.flatMap((slot) => slot.homeLinks ?? []).map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-brandCP transition-all duration-200 hover:gap-2"
        >
          {item.label}
          <ArrowIcon />
        </Link>
      ))}
    </>
  );
}
