/**
 * « Join the Lab » : l'inscription à la communauté du MyTwin Lab.
 *
 * Deux pages. `/join` prend l'e-mail et, en option, ce que la personne se
 * déclare être ; l'inscription entre au CRM de MyTwin sous la source
 * `lab_join` (`lib/server/crm.ts`). `/join/welcome` accueille le membre.
 *
 * Le Lab se souvient du membre par un cookie signé (`lib/server/labMember.ts`) :
 * son e-mail, jamais dans l'URL.
 *
 * Pur (ni base, ni `server-only`) : les pages, les formulaires client et les
 * server actions l'importent tous. Voir docs/join.md.
 */

export const JOIN_PATH = "/join";
export const JOIN_WELCOME_PATH = "/join/welcome";

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
 * Version du texte de consentement affiché sous le champ de `/join`. Le CRM la
 * fige avec l'inscription : elle dit à quelle promesse la personne a dit oui.
 * À changer dès que le texte change sur le fond.
 */
export const JOIN_CONSENT_VERSION = "2026-10-lab-news";

/** Les `utm_*` d'une inscription, enregistrés avec elle au CRM. */
export const JOIN_UTM = {
  source: "mytwinlab.care",
  medium: "join-page",
  campaign: "join-lab",
} as const;
