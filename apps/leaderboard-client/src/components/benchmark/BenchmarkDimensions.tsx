"use client";

import { useLayoutEffect, useRef, useState } from "react";

import { BenchmarkIcon, type BenchmarkIconName } from "./icons";

const DIMENSIONS: { icon: BenchmarkIconName; title: string; text: string }[] = [
  { icon: "person", title: "Personalization", text: "Individual-level modeling and representation" },
  { icon: "data", title: "Multimodality", text: "Diverse data types and sources" },
  { icon: "clock", title: "Longitudinality", text: "Temporal depth of data and models" },
  { icon: "refresh", title: "Dynamic updating", text: "Continuous learning and adaptation" },
  { icon: "layers", title: "Modeling depth", text: "Biological and clinical scope" },
  { icon: "bars", title: "Predictive capability", text: "Forecasting individual outcomes" },
  { icon: "shield", title: "Validation & uncertainty", text: "Evidence and confidence" },
  { icon: "target", title: "Actionability", text: "Practical and clinical utility" },
  { icon: "model", title: "Interoperability", text: "Compatibility and data exchange" },
  { icon: "lock", title: "Governance & safety", text: "Ethics, privacy and responsible use" },
];

const PHONE = "(max-width: 767px)";
const EASE = "cubic-bezier(0.22,0.61,0.21,1)";

/**
 * Les dix dimensions.
 *
 * Sur PC, dix cartes à plat : numéro, pictogramme, titre et description, rien
 * à ouvrir. Sur téléphone, la maquette les serre en deux colonnes réduites au
 * titre ; toucher une carte l'étend sur toute la largeur et montre sa
 * description, une seule à la fois — c'est le seul état de la page, d'où ce
 * composant client. La description reste dans le HTML dans les deux cas : la
 * feuille la masque, elle n'est pas retirée.
 *
 * Les cartes de la maquette PC sont des liens vers `#` avec un chevron. Elles
 * ne mènent nulle part pour l'instant : ni lien ni chevron tant que les pages
 * de dimension n'existent pas.
 */
export function BenchmarkDimensions() {
  const [open, setOpen] = useState<number | null>(null);
  const listRef = useRef<HTMLOListElement>(null);
  /** La place de chaque carte avant la bascule, pour animer depuis elle. */
  const before = useRef<Map<Element, DOMRect> | null>(null);

  const toggle = (index: number) => {
    // Hors téléphone il n'y a rien à ouvrir : tout est déjà affiché.
    if (!window.matchMedia(PHONE).matches) return;
    const items = Array.from(listRef.current?.children ?? []);
    before.current = new Map(items.map((li) => [li, li.getBoundingClientRect()]));
    setOpen((current) => (current === index ? null : index));
  };

  // La grille se réarrange d'un coup (`grid-auto-flow: dense`) ; chaque carte
  // glisse de son ancienne place à la nouvelle plutôt que de sauter.
  useLayoutEffect(() => {
    const rects = before.current;
    before.current = null;
    if (!rects || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    for (const li of Array.from(listRef.current?.children ?? [])) {
      const from = rects.get(li);
      if (!from) continue;
      const to = li.getBoundingClientRect();
      const dx = from.left - to.left;
      const dy = from.top - to.top;
      const resized =
        Math.abs(from.width / to.width - 1) > 0.01 || Math.abs(from.height / to.height - 1) > 0.01;

      if (resized) {
        li.animate(
          [
            { width: `${from.width}px`, height: `${from.height}px`, transform: `translate(${dx}px,${dy}px)` },
            { width: `${to.width}px`, height: `${to.height}px`, transform: "none" },
          ],
          { duration: 420, easing: EASE },
        );
      } else if (dx || dy) {
        li.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: "none" }], {
          duration: 420,
          easing: EASE,
        });
      }

      if (li.hasAttribute("data-open")) {
        li.querySelector(".v-bm-dim-text")?.animate(
          [
            { opacity: 0, transform: "translateY(-4px)" },
            { opacity: 1, transform: "none" },
          ],
          { duration: 300, delay: 160, easing: EASE, fill: "backwards" },
        );
      }
    }
  }, [open]);

  return (
    <ol ref={listRef} className="v-bm-dims">
      {DIMENSIONS.map((dimension, index) => {
        const isOpen = open === index;
        return (
          <li key={dimension.title} className="v-bm-dim" data-open={isOpen ? "" : undefined}>
            <button
              type="button"
              className="v-bm-dim-card"
              aria-expanded={isOpen}
              onClick={() => toggle(index)}
            >
              <span className="v-bm-dim-num" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <BenchmarkIcon name={dimension.icon} />
              <span className="v-bm-dim-body">
                <b className="v-bm-dim-title">{dimension.title}</b>
                <span className="v-bm-dim-text">{dimension.text}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
