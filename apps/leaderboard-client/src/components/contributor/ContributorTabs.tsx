"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { TabPills } from "@/components/ui/TabPills";

interface TabItem {
  label: string;
  panel: React.ReactNode;
  /** Le compteur de la pastille — les invitations en attente, par exemple. */
  count?: number;
}

/** L'onglet que porte un libellé, d'où qu'il vienne : `?tab=` ou une prop. */
function indexOfLabel(tabs: TabItem[], label: string | null | undefined) {
  if (!label) return -1;
  return tabs.findIndex(t => t.label.toLowerCase() === label.toLowerCase());
}

/**
 * Les onglets d'une page contributeur.
 *
 * Au style de la maquette `Profile Vitrine.dc.html` : les gélules sont celles
 * de `.v-tabs`, et chaque panneau arrive en fondu (`.v-pro-panel`). Le panneau
 * est remonté à chaque changement (`key={active}`) pour rejouer l'animation.
 *
 * `?tab=` peut aussi arriver après le montage — « All contributions » dans le
 * tableau de bord est un lien vers `?tab=contributions`. La navigation douce de
 * Next ne remonte pas ce composant, donc l'état initial ne suffisait pas : le
 * paramètre est suivi, et c'est lui qui déplace l'onglet.
 */
export function ContributorTabs({ tabs, initialTab, extra }: { tabs: TabItem[]; initialTab?: string; extra?: React.ReactNode }) {
  const [active, setActive] = useState(() => {
    const idx = indexOfLabel(tabs, initialTab);
    return idx >= 0 ? idx : 0;
  });

  const tabParam = useSearchParams().get("tab");
  // Les libellés comme dépendance, pas le tableau : il est recréé à chaque
  // rendu du parent, et l'effet tournerait pour rien.
  const labels = tabs.map(t => t.label).join("|");

  useEffect(() => {
    if (!tabParam) return;
    const idx = labels.split("|").findIndex(label => label.toLowerCase() === tabParam.toLowerCase());
    if (idx >= 0) setActive(idx);
  }, [tabParam, labels]);

  return (
    <>
      <TabPills
        variant="vitrine"
        tabs={tabs.map(({ label, count }) => ({ label, count }))}
        active={active}
        onChange={setActive}
      />

      {/* Content shared across every tab — meetings, in the redesign */}
      {extra && <div>{extra}</div>}

      <div key={active} className="v-pro-panel">
        {tabs[active].panel}
      </div>
    </>
  );
}
