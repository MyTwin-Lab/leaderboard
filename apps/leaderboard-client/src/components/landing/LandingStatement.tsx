import Link from "next/link";

import { ArrowIcon } from "./ArrowIcon";
import { Reveal } from "./Reveal";

// La seule phrase en serif de la landing, et la porte d'entrée vers la web app.
export function LandingStatement() {
  return (
    <section className="l-container">
      <Reveal className="l-statement">
        <h2 className="l-display l-statement__text">Health innovation, built in the open</h2>
        <Link href="/home" className="l-button l-button--large">
          Enter the Lab
          <ArrowIcon />
        </Link>
      </Reveal>
    </section>
  );
}
