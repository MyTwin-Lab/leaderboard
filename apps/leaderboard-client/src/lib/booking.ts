/**
 * La prise de rendez-vous : la page `/book` du Lab, puis la page Calendly de
 * Rubens, où le créneau se choisit.
 *
 * Le Lab ne stocke rien : le prénom et l'e-mail saisis sur `/book` partent
 * dans l'URL Calendly, qui les pré-remplit, avec des `utm_*` qui disent d'où
 * vient la demande. Calendly les garde avec la réservation, sur le plan
 * gratuit comme sur les autres ; le CRM les reprendra (voir docs/booking.md).
 *
 * Pur (ni base, ni `server-only`) : la page serveur et le formulaire client
 * l'importent tous les deux.
 */

export const BOOKING_PATH = "/book";

/** L'événement « MyTwin Lab », 30 min en one-to-one avec Rubens. */
export const CALENDLY_EVENT_URL = "https://calendly.com/rubens-mytwin/30min";

/** Pourquoi on prend rendez-vous : chaque appel du Lab en porte un. */
export type BookingIntent = "twin" | "project";

/** L'`utm_campaign` de chaque intention : c'est elle qui trie les demandes dans Calendly. */
const CAMPAIGN_BY_INTENT: Record<BookingIntent, string> = {
  twin: "create-your-twin",
  project: "sandbox-project",
};

/** Lit `?for=` ; une valeur absente ou inconnue ouvre la page sans intention. */
export function parseBookingIntent(value: string | string[] | undefined): BookingIntent | null {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "twin" || raw === "project" ? raw : null;
}

export function bookingPath(intent: BookingIntent): string {
  return `${BOOKING_PATH}?for=${intent}`;
}

/**
 * L'URL Calendly, pré-remplie. `name` et `email` sont les paramètres que la
 * page Calendly lit pour remplir « Enter Details » ; les `utm_*` sont
 * enregistrés avec la réservation.
 */
export function calendlyBookingUrl({
  firstName,
  email,
  intent,
}: {
  firstName: string;
  email: string;
  intent: BookingIntent | null;
}): string {
  const url = new URL(CALENDLY_EVENT_URL);
  url.searchParams.set("name", firstName.trim());
  url.searchParams.set("email", email.trim());
  url.searchParams.set("utm_source", "mytwinlab.care");
  url.searchParams.set("utm_medium", "booking-page");
  url.searchParams.set("utm_campaign", intent ? CAMPAIGN_BY_INTENT[intent] : "general");
  return url.toString();
}
