/**
 * L'ouverture de l'accueil : la mission, et rien d'autre.
 *
 * Le seul mouvement de la page est ici — une montée en fondu au chargement.
 * La maquette n'en met nulle part ailleurs : pas de révélation section par
 * section au défilement.
 */
export function HomeHero() {
  return (
    <section className="v-home-mission" aria-labelledby="mission-title">
      <span id="mission-title" className="v-home-eyebrow">
        Our mission
      </span>
      <h1>
        A collective mission to build the world&rsquo;s most advanced{" "}
        <em>human digital twin</em> and make health innovation accessible to everyone.
      </h1>
    </section>
  );
}
