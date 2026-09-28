"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useModuleSlots } from "@/distribution/mytwin.modules";

/**
 * La carte d'« Open resources » : son lien dépend des modules actifs.
 *
 * Quand le module watch est actif, la ressource est l'explorateur de
 * publications de la plateforme (`/watch`, le slot `homeLinks` du module) :
 * un lien interne, même onglet. Sinon, la carte renvoie vers le script de
 * veille hébergé ailleurs, comme avant le module — lien sortant, nouvel onglet.
 *
 * L'état des modules est dans le cache dès le rendu serveur (`app/layout.tsx`) :
 * le bon lien est dans le HTML initial, sans bascule après coup.
 */
export function HomeResourceCard({
  fallbackHref,
  children,
}: {
  /** La ressource externe, faute de module qui en fournisse une. */
  fallbackHref: string;
  children: ReactNode;
}) {
  const { slots } = useModuleSlots();
  const internal = slots.flatMap((slot) => slot.homeLinks ?? [])[0];

  if (internal) {
    return (
      <Link href={internal.href} className="v-home-feature">
        {children}
      </Link>
    );
  }

  return (
    <a href={fallbackHref} target="_blank" rel="noopener noreferrer" className="v-home-feature">
      {children}
      {/* Hors de `.v-home-read` : le téléphone masque cet appel, et la
          mention disparaîtrait avec lui de l'arbre d'accessibilité. */}
      <span className="sr-only">Opens in a new tab</span>
    </a>
  );
}
