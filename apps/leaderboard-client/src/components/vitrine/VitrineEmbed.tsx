import type { ReactNode } from "react";
import { vitrineFontVars } from "./fonts";

import "./vitrine.css";
import "./forms-vitrine.css";

/**
 * La racine d'un fragment vitrine posé dans une page qui n'en est pas une :
 * un formulaire en ligne de l'admin, un panneau de la vue de pilotage. Elle
 * apporte les jetons `--v-*`, le réarmement et les polices de la maquette,
 * sans la mise en page pleine hauteur d'une page vitrine.
 *
 * `card` dessine la surface blanche et son filet autour du contenu — pour un
 * formulaire qui s'affiche au milieu d'une page sombre —, et `title` son
 * titre en tête. C'est la page qui pose la carte et son titre ; le formulaire
 * qu'elle contient reste nu, pour ne jamais dessiner deux cadres.
 */
export function VitrineEmbed({ children, className, card = false, title }: { children: ReactNode; className?: string; card?: boolean; title?: ReactNode }) {
  return (
    <div className={`vitrine-embed ${vitrineFontVars} ${className ?? ""}`}>
      {card ? (
        <div className="v-embed-card">
          {title && <h3 className="v-embed-title">{title}</h3>}
          {children}
        </div>
      ) : children}
    </div>
  );
}
