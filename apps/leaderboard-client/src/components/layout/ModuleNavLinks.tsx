"use client";

import Link from "next/link";
import { useModuleSlots } from "@/distribution/mytwin.modules";

/** Les entrées de navigation publique des modules actifs, pour un composant serveur comme le pied de page. */
export function ModuleNavLinks({ className }: { className?: string }) {
  const { slots } = useModuleSlots();
  return (
    <>
      {slots.flatMap((slot) => slot.publicNav ?? []).map((item) => (
        <Link key={item.href} href={item.href} className={className}>
          {item.label}
        </Link>
      ))}
    </>
  );
}
