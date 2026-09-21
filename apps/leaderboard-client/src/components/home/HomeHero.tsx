import Image from "next/image";

/**
 * La mission, puis le schéma du jumeau numérique qui la dessine. Le schéma est
 * sur fond blanc : il est posé dans un cadre blanc, pour se lire comme une
 * planche dans les deux modes du thème.
 */
export function HomeHero() {
  return (
    <section className="animate-fade-up flex min-w-0 flex-col gap-4">
      <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
        Our mission
      </h1>

      <p className="text-sm leading-relaxed text-white/60 sm:text-base">
        Students, engineers, clinicians, researchers and citizens contributing to a shared
        mission: creating the most advanced digital twin of the human body and making the
        best health innovations accessible to everyone. Every contribution is tracked,
        evaluated and rewarded in CP.
      </p>

      <div className="mt-1 overflow-hidden rounded-2xl border border-white/10 bg-white p-2 shadow-[0_18px_50px_-24px_rgba(0,0,0,0.55)] sm:rounded-3xl sm:p-3">
        <Image
          src="/prez-digital-twin.jpeg"
          alt="The MyTwin digital twin: the data it brings together, the body it models from organs down to molecules, past, present and possible futures, and what it makes possible: predict, prevent, personalise, simulate, act."
          width={1846}
          height={852}
          sizes="(min-width: 1152px) 1080px, calc(100vw - 3rem)"
          priority
          className="h-auto w-full rounded-xl sm:rounded-2xl"
        />
      </div>
    </section>
  );
}
