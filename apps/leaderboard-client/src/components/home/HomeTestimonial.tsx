import Image from "next/image";

/**
 * Le témoignage du fondateur, juste avant les news.
 *
 * Une section comme les autres — même filet, même rythme, mêmes polices —
 * à ceci près qu'elle n'a pas de sur-titre. C'est un grand guillemet en
 * filigrane qui dit qu'on lit une parole, en haut à gauche de la citation
 * (voir `home-vitrine.css`).
 *
 * `<figure>` / `<blockquote>` / `<figcaption>` : la citation et son auteur
 * restent liés pour les lecteurs d'écran comme pour les moteurs.
 */
export function HomeTestimonial() {
  return (
    <section
      aria-label="A word from the founder"
      className="v-home-section v-home-quote-section"
    >
      <figure className="v-home-quote">
        <span className="v-home-quote-mark" aria-hidden="true" />

        <blockquote>
          <p>
            In 10 years, 50% of the world&rsquo;s population will have their
            digital twin, directly accessible via their smartphone, ensuring
            universal access to the best prevention, prediction, and health
            personalization tools.
          </p>
        </blockquote>

        <figcaption className="v-home-quote-author">
          <span className="v-home-quote-photo">
            <Image
              src="/home/rubens-valcy.webp"
              alt=""
              width={96}
              height={96}
              loading="lazy"
            />
          </span>
          <span className="v-home-quote-who">
            <cite>Rubens Valcy</cite>
            <span>Founder of MyTwin</span>
          </span>
        </figcaption>
      </figure>
    </section>
  );
}
