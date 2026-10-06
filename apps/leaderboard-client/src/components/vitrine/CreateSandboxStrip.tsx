import Link from "next/link";
import { bookingPath, type BookingOrigin } from "@/lib/booking";
import { cn } from "@/lib/utils";

/**
 * Le bandeau nuit de bas de page — le même sur `/challenges`, `/leaderboard`
 * et `/sandbox` : une question, un bouton, rien d'autre.
 *
 * Le bouton mène à la prise de rendez-vous (`/book?for=sandbox-project`), pour tout le
 * monde : un projet se propose en en parlant avec l'équipe, plus en déposant
 * soi-même une sandbox depuis ce bandeau. `from` est la page qui l'affiche :
 * le retour de `/book` y ramène.
 *
 * Les mesures sont celles de `.v-strip` dans `vitrine.css` ; chaque page garde
 * sa règle téléphone, sa gouttière n'étant pas la même.
 */
export function CreateSandboxStrip({
  from,
  className,
}: {
  from: BookingOrigin;
  className?: string;
}) {
  return (
    <section className={cn("v-strip", className)}>
      <div className="v-strip-text">
        <span className="v-strip-title">Got a project of your own?</span>
      </div>
      <Link href={bookingPath("sandbox-project", from)} className="v-strip-cta">
        Create your sandbox
      </Link>
    </section>
  );
}
