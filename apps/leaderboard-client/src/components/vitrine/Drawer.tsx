"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { vitrineFontVars } from "./fonts";

import "./vitrine.css";
import "./forms-vitrine.css";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** Une ligne sous le titre : ce que le tiroir fait, ou sur quoi il porte. */
  subtitle?: ReactNode;
  /** L'icône de la pastille de tête (une icône lucide, sans classe de taille). */
  icon?: ReactNode;
  /** Le pied : boutons d'action. Absent, pas de bandeau. */
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  /** Une classe de plus sur la racine, pour une feuille propre à un tiroir. */
  className?: string;
  children: ReactNode;
}

/**
 * Le tiroir du design vitrine — la coque commune de tout ce qui glisse depuis
 * la droite pour créer ou éditer quelque chose.
 *
 * Toujours monté, il glisse depuis `open` : conditionner le montage le
 * rendrait déjà en place, sans animation. Rendu par un portail vers
 * `document.body` : un panneau `fixed` dans un sous-arbre porteur d'une
 * transformation se retrouverait confiné dans la boîte de cet ancêtre.
 *
 * La racine porte `.vitrine-embed` et les polices de la maquette : le tiroir
 * s'ouvre souvent sur une page qui n'est pas une vitrine (l'admin, la vue de
 * pilotage), et sans les jetons `--v-*` rien ne s'habille.
 */
export function Drawer({ open, onClose, title, subtitle, icon, footer, size = "md", className, children }: DrawerProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <div className={`vitrine-embed ${vitrineFontVars} ${className ?? ""}`}>
      <div className="v-drawer" data-open={open ? "true" : "false"} aria-hidden={!open}>
        <div className="v-drawer-backdrop" onClick={onClose} />
        <div className="v-drawer-panel" data-size={size} role="dialog" aria-modal="true">
          <div className="v-drawer-head">
            {icon && <div className="v-drawer-icon">{icon}</div>}
            <div className="v-drawer-head-text">
              <h2 className="v-drawer-title">{title}</h2>
              {subtitle && <p className="v-drawer-sub">{subtitle}</p>}
            </div>
            <button type="button" className="v-drawer-close" onClick={onClose} aria-label="Close">
              <X />
            </button>
          </div>

          <div className="v-drawer-body">{children}</div>

          {footer && <div className="v-drawer-foot">{footer}</div>}
        </div>
      </div>
    </div>,
    document.body,
  );
}
