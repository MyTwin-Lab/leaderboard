"use client";

import { useState, type ReactNode } from "react";
import { Plus } from "lucide-react";

import type { ModuleProvider } from "@/content/marketplace/types";

type Filter = "all" | ModuleProvider["kind"];

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All modules" },
  { key: "mytwin", label: "MyTwin" },
  { key: "partner", label: "Partners" },
];

/**
 * La grille du catalogue, et son seul filtre : MyTwin ou partenaire. Dix
 * modules n'appellent pas de recherche ; la distinction de propriété, elle,
 * est celle que les trois publics demandent d'abord.
 *
 * Les cartes arrivent rendues par le serveur (`ModuleCard`), avec la seule
 * donnée dont le filtre a besoin : le registre et ses fiches ne partent pas
 * dans le bundle client. Toutes sont dans le HTML initial (« All modules »
 * par défaut) ; le filtre ne fait qu'en masquer.
 */
export function ModuleCatalog({ items }: { items: { slug: string; kind: ModuleProvider["kind"]; card: ReactNode }[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const shown = filter === "all" ? items : items.filter((item) => item.kind === filter);
  const count = (key: Filter) => (key === "all" ? items.length : items.filter((item) => item.kind === key).length);

  return (
    <section className="v-mk-catalog" aria-labelledby="marketplace-catalog">
      <div className="v-mk-catalog-head">
        <h2 id="marketplace-catalog" className="v-mk-section-title">
          Module catalog
        </h2>
        <div className="v-pills" role="group" aria-label="Filter modules by provider">
          {FILTERS.map((option) => (
            <button
              key={option.key}
              type="button"
              className="v-pill"
              data-on={filter === option.key}
              aria-pressed={filter === option.key}
              onClick={() => setFilter(option.key)}
            >
              {option.label}
              <span className="v-pill-count">{count(option.key)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="v-mk-grid">
        {shown.map((item) => (
          <div key={item.slug} className="v-mk-grid-item">
            {item.card}
          </div>
        ))}

        {/* « Others » dans la plaquette : pas un module, l'annonce des suivants. */}
        {filter === "all" && (
          <div className="v-mk-more">
            <span className="v-mk-icon" data-quiet="true">
              <Plus strokeWidth={1.6} aria-hidden="true" />
            </span>
            <p className="v-mk-more-title">More modules coming</p>
            <p className="v-mk-more-text">
              The catalog grows as new MyTwin and partner modules are documented.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
