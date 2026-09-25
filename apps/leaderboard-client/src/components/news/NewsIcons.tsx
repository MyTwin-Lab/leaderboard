/**
 * Les trois icônes de la maquette `News Detail Redesign Vitrine.dc.html`,
 * dessinées à ses mesures. Pas de `lucide-react` ici : la maquette pose ses
 * propres tracés, et leur épaisseur (1.4 / 1.5) fait partie de sa matière.
 *
 * La taille est réglée en CSS (`.v-nd-… svg`), pas ici : la même flèche mesure
 * 16px dans l'en-tête et 13px sous le rail des news. `className` n'est là que
 * pour l'index `/news`, resté au chrome du Lab, qui n'a pas cette feuille.
 */

export function NewsArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden className={className}>
      <path
        d="M13 8H3m0 0 4-4M3 8l4 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function NewsArrowRightIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M3 8h10m0 0L9 4m4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function NewsClockIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4.8V8l2.2 1.4" strokeLinecap="round" />
    </svg>
  );
}
