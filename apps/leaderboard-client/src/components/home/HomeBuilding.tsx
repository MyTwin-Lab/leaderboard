import { MYTWIN } from "@/lib/seo";
import { ArrowIcon } from "./ArrowIcon";
import { TwinConstellation } from "./TwinConstellation";

/**
 * « What we are building » : ce vers quoi le travail du Lab converge.
 *
 * Le territoire « digital twin » appartient à mytwin.care (docs/seo.md) : la
 * section ne le vise pas dans son titre et renvoie vers mytwin.care, comme le
 * lien du H1. Elle dit ce que le Lab construit, mytwin.care dit ce qu'est
 * MyTwin.
 */
export function HomeBuilding() {
  return (
    <section aria-labelledby="building-title" className="grid items-center gap-4 lg:grid-cols-2 lg:gap-10">
      <div className="flex flex-col gap-4">
        <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/45">What we are building</span>
        <h2
          id="building-title"
          className="text-balance text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl"
        >
          One evolving digital representation of human health
        </h2>
        <p className="text-base leading-relaxed text-white/60 sm:text-lg">
          Built to make healthcare more predictive, preventive, personalized and proactive.
        </p>
        <p className="text-sm leading-relaxed text-white/60 sm:text-base">
          The applications around it come from our technology partners and from the challenges and
          Sandbox projects built here, in the Lab.
        </p>
        <a
          href={MYTWIN.home}
          className="mt-2 inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-brandCP transition-all duration-200 hover:gap-2"
        >
          Discover MyTwin
          <ArrowIcon />
        </a>
      </div>

      <TwinConstellation twinAlt="Human digital twin surrounded by the health applications built around it" />
    </section>
  );
}
