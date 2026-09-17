import type { NewsFact } from "@/content/news/types";

/**
 * « At a glance » : l'essentiel de la news en quelques lignes (quand, qui,
 * quoi, où on en est). Pour le lecteur pressé, et pour les moteurs de réponse,
 * qui citent volontiers un fait posé aussi nettement.
 */
export function NewsKeyFacts({ facts }: { facts: NewsFact[] }) {
  return (
    <aside
      aria-labelledby="at-a-glance"
      className="mt-10 rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:p-6"
    >
      <p id="at-a-glance" className="text-[11px] font-bold uppercase tracking-[0.2em] text-brandCP">
        At a glance
      </p>
      <dl className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">
        {facts.map((fact) => (
          <div key={fact.label} className="flex flex-col gap-1">
            <dt className="text-xs text-white/45">{fact.label}</dt>
            <dd className="text-sm font-medium leading-relaxed text-white">{fact.value}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}
