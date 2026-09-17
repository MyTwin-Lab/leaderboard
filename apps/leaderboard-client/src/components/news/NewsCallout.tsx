/**
 * Réservé à l'idée que le lecteur doit emporter s'il ne retient qu'une phrase
 * de la section. Un encadré par section au plus, sinon plus rien ne ressort.
 */
export function NewsCallout({ children }: { children: React.ReactNode }) {
  return (
    <aside className="relative my-8 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] py-5 pl-7 pr-6 sm:py-6 sm:pl-8">
      <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-brandCP" />
      <div className="text-pretty text-base font-semibold leading-relaxed text-white sm:text-lg [&>p+p]:mt-2">
        {children}
      </div>
    </aside>
  );
}
