// `timeZone: "UTC"` : une date ISO sans heure est minuit UTC. Formatée dans le
// fuseau d'un serveur à l'ouest de Greenwich, elle afficherait la veille.
const DAY = new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" });
const MONTH = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

/** `2026-09-16` → « September 16, 2026 ». */
export function formatNewsDate(iso: string): string {
  return DAY.format(new Date(iso));
}

/** `2025-05` → « May 2025 ». */
export function formatEventMonth(month: string): string {
  return MONTH.format(new Date(`${month}-01`));
}
