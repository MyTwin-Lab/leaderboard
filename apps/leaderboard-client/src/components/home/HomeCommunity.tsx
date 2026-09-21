import { COMMUNITY_MEMBERS } from "@/content/community";
import { HomeCommunityCarousel } from "./HomeCommunityCarousel";

/**
 * « Join our Community », repris de la landing `/` sans son « Enter the Lab » :
 * on est déjà dans le Lab. Même texte, mêmes visages, aux couleurs du thème.
 */
export function HomeCommunity() {
  return (
    <section aria-labelledby="community-title" className="flex flex-col items-center gap-3 text-center">
      <h2 id="community-title" className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
        Join our Community
      </h2>
      <p className="max-w-xl text-sm leading-relaxed text-white/60 sm:text-base">
        Students, engineers, clinicians, researchers and citizens, building the future of health together.
      </p>

      {/* Liste lisible par les lecteurs d'écran et les moteurs : le carousel est décoratif. */}
      <ul className="sr-only">
        {COMMUNITY_MEMBERS.map((member, index) => (
          <li key={`${member.name}-${index}`}>
            {member.name}, {member.role}
          </li>
        ))}
      </ul>

      {/* Au téléphone, le carousel dépasse le padding du <main> : les visages
          défilent jusqu'au bord de l'écran. */}
      <div className="-mx-4 mt-3 self-stretch sm:-mx-6 md:mx-0">
        <HomeCommunityCarousel members={COMMUNITY_MEMBERS} />
      </div>
    </section>
  );
}
