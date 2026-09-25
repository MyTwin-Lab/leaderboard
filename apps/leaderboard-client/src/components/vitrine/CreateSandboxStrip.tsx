import Link from "next/link";
import { cn } from "@/lib/utils";

/** Le seul appel du bandeau, le même sur les trois listings. */
export const CREATE_SANDBOX_LABEL = "Create your sandbox";

/**
 * Le bandeau nuit de bas de page — le même sur `/challenges`, `/leaderboard`
 * et `/sandbox` : une question, un bouton, rien d'autre.
 *
 * Il porte seul la création d'une sandbox depuis que le bouton noir de la
 * barre de filtres a disparu. Par défaut il mène à `/sandbox` ; la page
 * Sandbox, elle, y branche sa propre action (`action`), puisque la modale de
 * création est chez elle.
 *
 * Les mesures sont celles de `.v-strip` dans `vitrine.css` ; chaque page garde
 * sa règle téléphone, sa gouttière n'étant pas la même.
 */
export function CreateSandboxStrip({
  action,
  className,
}: {
  /** Ce que fait le bouton quand ce n'est pas « aller sur `/sandbox` ». */
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("v-strip", className)}>
      <div className="v-strip-text">
        <span className="v-strip-title">Got a project of your own?</span>
      </div>
      {action ?? (
        <Link href="/sandbox" className="v-strip-cta">
          {CREATE_SANDBOX_LABEL}
        </Link>
      )}
    </section>
  );
}
