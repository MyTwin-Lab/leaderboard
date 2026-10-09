/**
 * « Join the Lab » : l'inscription à la communauté du MyTwin Lab.
 *
 * Trois pages. `/join` prend l'e-mail et, en option, ce que la personne se
 * déclare être ; l'inscription entre au CRM de MyTwin sous la source
 * `lab_join` (`lib/server/crm.ts`). `/join/welcome` accueille le membre et lui
 * propose trois premiers pas ; `/join/share` recueille son anecdote de santé.
 *
 * Le Lab se souvient du membre par un cookie signé (`lib/server/labMember.ts`) :
 * son e-mail, et les pas déjà faits. Jamais l'e-mail dans l'URL.
 *
 * Pur (ni base, ni `server-only`) : les pages, les formulaires client et les
 * server actions l'importent tous. Voir docs/join.md.
 */

export const JOIN_PATH = "/join";
export const JOIN_WELCOME_PATH = "/join/welcome";
export const JOIN_SHARE_PATH = "/join/share";

/** La communauté WhatsApp du Lab : débats, idées, retours. */
export const WHATSAPP_COMMUNITY_URL = "https://chat.whatsapp.com/LUyEB3XFUud3clEYJQCSqF?mode=gi_t";

/**
 * Ce que le visiteur peut se déclarer être. Les valeurs sont celles de l'enum
 * `CrmLabRole` de MyTwinOS, qui les traduit en type de fiche (le chercheur en
 * `expert`, le développeur en `contributor`, « Other » en `unknown`).
 */
export const LAB_ROLES = ["patient", "clinician", "researcher", "developer", "other"] as const;
export type LabRole = (typeof LAB_ROLES)[number];

/** Rien de coché vaut « Other » : la personne ne s'est reconnue dans aucun. */
export function parseLabRole(value: unknown): LabRole {
  return LAB_ROLES.includes(value as LabRole) ? (value as LabRole) : "other";
}

/**
 * Les premiers pas qui se cochent. « Explore the challenges » n'en est pas un :
 * il ouvre une page, il ne s'accomplit pas.
 */
export const JOIN_STEPS = ["anecdote", "whatsapp"] as const;
export type JoinStep = (typeof JOIN_STEPS)[number];

export function isJoinStep(value: unknown): value is JoinStep {
  return JOIN_STEPS.includes(value as JoinStep);
}

/**
 * Version du texte de consentement affiché sous le champ de `/join`. Le CRM la
 * fige avec l'inscription : elle dit à quelle promesse la personne a dit oui.
 * À changer dès que le texte change sur le fond.
 */
export const JOIN_CONSENT_VERSION = "2026-10-lab-news";

/**
 * Celle de l'anecdote. Le texte est mot pour mot celui de `/welcome` sur
 * mytwin.care : même promesse, même version (`HEALTH_ANECDOTE_CONSENT_VERSION`
 * de mytwin-health-landing). Si l'un change, l'autre ne la partage plus.
 */
export const ANECDOTE_CONSENT_VERSION = "2026-08-anonymous-internal-use";
export const ANECDOTE_MAX_LENGTH = 5000;

/** Les `utm_*` d'une inscription, enregistrés avec elle au CRM. */
export const JOIN_UTM = {
  source: "mytwinlab.care",
  medium: "join-page",
  campaign: "join-lab",
} as const;
