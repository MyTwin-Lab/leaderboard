import Link from "next/link";

interface ContributorTopBarProps {
  actions?: React.ReactNode;
}

/**
 * La ligne au-dessus de la fiche : le retour au classement, et à droite les
 * actions de sa propre page (Admin, Log out).
 *
 * La maquette pose ces deux actions dans son en-tête ; ici l'en-tête est la
 * navbar du Lab, partagée par toute l'app, et elle porte déjà l'avatar. Elles
 * restent donc dans la page, à la forme des gélules de la maquette. Le retour
 * emprunte `.v-back` des autres vitrines : la maquette ne l'a pas, mais on
 * arrive ici depuis `/leaderboard` et il n'y a rien d'autre pour y repartir.
 */
export function ContributorTopBar({ actions }: ContributorTopBarProps) {
  return (
    <div className="v-pro-top">
      <Link href="/leaderboard" className="v-back">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
        Leaderboard
      </Link>
      {actions && <div className="v-pro-actions">{actions}</div>}
    </div>
  );
}
