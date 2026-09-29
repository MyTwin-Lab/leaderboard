"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { vitrineFontVars } from "./fonts";

import "./vitrine.css";
import "./forms-vitrine.css";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  /** L'icône de la pastille de tête ; `tone="danger"` la passe en rouge. */
  icon?: ReactNode;
  tone?: "accent" | "danger";
  /** Les actions, en bas de la carte (`.v-modal-actions` est posé ici). */
  actions?: ReactNode;
  size?: "sm" | "md" | "lg";
  /** Centrée verticalement (une confirmation) plutôt qu'en haut (un formulaire long). */
  center?: boolean;
  /** Un `z-index` plus haut, pour une modale ouverte par-dessus un tiroir. */
  above?: boolean;
  className?: string;
  children?: ReactNode;
}

/**
 * La modale du design vitrine — la carte centrée de « New sandbox », reprise
 * pour tout ce qui demande une réponse ou une saisie courte : rejoindre un
 * challenge, confirmer une suppression, lier un dépôt.
 *
 * Démontée quand elle est fermée (elle joue une arrivée, pas un glissement),
 * portée vers `document.body`, et habillée par sa propre racine
 * `.vitrine-embed` comme le tiroir.
 */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  icon,
  tone = "accent",
  actions,
  size = "md",
  center = false,
  above = false,
  className,
  children,
}: ModalProps) {
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

  if (!open || !mounted) return null;

  return createPortal(
    <div className={`vitrine-embed ${vitrineFontVars} ${className ?? ""}`}>
      <div className="v-modal" data-center={center ? "true" : "false"} style={above ? { zIndex: 70 } : undefined}>
        <div className="v-modal-backdrop" onClick={onClose} aria-hidden />
        <div className="v-modal-card" data-size={size} data-anim="pop" role="dialog" aria-modal="true">
          <div className="v-modal-head">
            {icon && (
              <div className="v-modal-icon" data-tone={tone}>
                {icon}
              </div>
            )}
            <div className="v-modal-head-text">
              <h2 className="v-modal-title">{title}</h2>
              {subtitle && <p className="v-modal-sub">{subtitle}</p>}
            </div>
            <button type="button" className="v-modal-close" onClick={onClose} aria-label="Close">
              <X />
            </button>
          </div>

          {children}

          {actions && <div className="v-modal-actions" data-align="end">{actions}</div>}
        </div>
      </div>
    </div>,
    document.body,
  );
}
