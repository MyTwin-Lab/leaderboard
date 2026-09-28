"use client";

import Link from "next/link";
import { useModuleSlots } from "@/distribution/mytwin.modules";

/**
 * Les entrées de navigation publique des modules actifs, pour un composant
 * serveur comme le pied de page. `listItems` : chaque lien dans un `<li>`,
 * pour une colonne rendue en liste.
 */
export function ModuleNavLinks({ className, listItems = false }: { className?: string; listItems?: boolean }) {
  const { slots } = useModuleSlots();
  const links = slots.flatMap((slot) => slot.publicNav ?? []);
  return (
    <>
      {links.map((item) =>
        listItems ? (
          <li key={item.href}>
            <Link href={item.href} className={className}>
              {item.label}
            </Link>
          </li>
        ) : (
          <Link key={item.href} href={item.href} className={className}>
            {item.label}
          </Link>
        ),
      )}
    </>
  );
}
