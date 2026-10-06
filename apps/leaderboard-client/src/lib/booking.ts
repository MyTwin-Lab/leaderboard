/**
 * La prise de rendez-vous : la page `/book` du Lab, puis la page Calendly de
 * Rubens, où le créneau se choisit.
 *
 * Le prénom et l'e-mail saisis sur `/book` entrent d'abord dans le CRM de
 * MyTwin (`lib/server/crm.ts`), sous la source de l'appel qui a mené ici, puis
 * partent dans l'URL Calendly, qui les pré-remplit, avec des `utm_*` qui
 * disent la même chose : `utm_campaign` est l'intention, `utm_content` la
 * soumission CRM. Le webhook Calendly, le jour où il existera, retrouvera la
 * soumission par là (voir docs/booking.md).
 *
 * Pur (ni base, ni `server-only`) : la page serveur, le formulaire client et
 * la server action l'importent tous.
 */

export const BOOKING_PATH = "/book";

/** L'événement « MyTwin Lab », 30 min en one-to-one avec Rubens. */
export const CALENDLY_EVENT_URL = "https://calendly.com/rubens-mytwin/30min";

/**
 * Pourquoi on prend rendez-vous : chaque appel du Lab en porte un. La valeur
 * est à la fois le `?for=` de `/book` et l'`utm_campaign` envoyé à Calendly.
 */
export const BOOKING_INTENTS = [
  "twin-creation",
  "sandbox-project",
  "scientific-committee",
] as const;
export type BookingIntent = (typeof BOOKING_INTENTS)[number];

/** L'`utm_campaign` d'une visite de `/book` sans intention. */
export const GENERAL_CAMPAIGN = "general";

/**
 * La source CRM de chaque intention. Une valeur de l'enum `CrmSource` de
 * MyTwinOS : la mutation refuse toute autre chose qu'une source `lab_*`.
 */
export type BookingCrmSource =
  | "lab_twin_creation"
  | "lab_sandbox_project"
  | "lab_scientific_committee"
  | "lab_general";

const CRM_SOURCE_BY_INTENT: Record<BookingIntent, BookingCrmSource> = {
  "twin-creation": "lab_twin_creation",
  "sandbox-project": "lab_sandbox_project",
  "scientific-committee": "lab_scientific_committee",
};

export function bookingCrmSource(intent: BookingIntent | null): BookingCrmSource {
  return intent ? CRM_SOURCE_BY_INTENT[intent] : "lab_general";
}

/** Les `utm_*` d'une demande, communs au CRM et à Calendly. */
export function bookingUtm(intent: BookingIntent | null) {
  return {
    source: "mytwinlab.care",
    medium: "booking-page",
    campaign: intent ?? GENERAL_CAMPAIGN,
  };
}

/** Lit `?for=` ; une valeur absente ou inconnue ouvre la page sans intention. */
export function parseBookingIntent(value: unknown): BookingIntent | null {
  const raw = Array.isArray(value) ? value[0] : value;
  return BOOKING_INTENTS.find((intent) => intent === raw) ?? null;
}

export function bookingPath(intent: BookingIntent): string {
  return `${BOOKING_PATH}?for=${intent}`;
}

/**
 * L'URL Calendly, pré-remplie. `name` et `email` sont les paramètres que la
 * page Calendly lit pour remplir « Enter Details » ; les `utm_*` sont
 * enregistrés avec la réservation. `utm_content` porte la soumission CRM
 * quand elle a pu être créée.
 */
export function calendlyBookingUrl({
  firstName,
  email,
  intent,
  submissionUuid,
}: {
  firstName: string;
  email: string;
  intent: BookingIntent | null;
  submissionUuid: string | null;
}): string {
  const utm = bookingUtm(intent);
  const url = new URL(CALENDLY_EVENT_URL);
  url.searchParams.set("name", firstName.trim());
  url.searchParams.set("email", email.trim());
  url.searchParams.set("utm_source", utm.source);
  url.searchParams.set("utm_medium", utm.medium);
  url.searchParams.set("utm_campaign", utm.campaign);
  if (submissionUuid) url.searchParams.set("utm_content", submissionUuid);
  return url.toString();
}
