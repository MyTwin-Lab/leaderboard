import "server-only";

import type { BookingCrmSource } from "@/lib/booking";
import type { LabRole } from "@/lib/join";

/**
 * Le CRM de MyTwin (MyTwinOS, package `crm`)
 * ------------------------------------------
 * Deux portes, deux mutations publiques `crmSubmit*` : le Lab ne lit
 * rien du CRM, il y dépose. `fetch` natif sur l'endpoint GraphQL du backend,
 * `MYTWIN_BACKEND_GRAPHQL_URL` — la même variable que mytwin-health-landing.
 *
 * - `crmSubmitBookingRequest` — `/book`, avant le départ vers Lemcal ;
 * - `crmSubmitLabJoin` — `/join`, l'inscription au Lab.
 *
 * Ne lève jamais : un CRM absent, lent ou en erreur rend `null`, et c'est à
 * l'appelant de décider. `/book` et `/join` laissent passer le visiteur quand
 * même : perdre un rendez-vous ou une inscription parce que le backend a eu un
 * raté coûterait plus cher que la ligne CRM manquante.
 */

export const CRM_TIMEOUT_MS = 5_000;

const SUBMIT_BOOKING_REQUEST = /* GraphQL */ `
  mutation CrmSubmitBookingRequest($input: CrmBookingRequestInput!) {
    crmSubmitBookingRequest(input: $input) {
      submissionUuid
    }
  }
`;

const SUBMIT_LAB_JOIN = /* GraphQL */ `
  mutation CrmSubmitLabJoin($input: CrmLabJoinInput!) {
    crmSubmitLabJoin(input: $input) {
      submissionUuid
      isFirstOfKind
    }
  }
`;

interface CrmUtm {
  source: string;
  medium: string;
  campaign: string;
}

export interface BookingRequest {
  source: BookingCrmSource;
  firstName: string;
  email: string;
  utm: CrmUtm;
}

export interface LabJoinRequest {
  email: string;
  role: LabRole;
  consentVersion: string;
  utm: CrmUtm;
}

export interface LabJoinResult {
  submissionUuid: string;
  /** Première inscription de cet e-mail au Lab — `false` pour un membre qui revient. */
  isFirstOfKind: boolean;
}

interface CrmOptions {
  endpoint?: string;
  fetchImpl?: typeof fetch;
}

interface CrmResponse<T> {
  data?: Record<string, T | null | undefined>;
  errors?: { message: string }[];
}

/**
 * Le chemin commun : POST, délai borné, réponse lue sans confiance. Rend le
 * champ de la mutation, ou `null` en journalisant sous `[crm:<tag>]`.
 */
async function submit<T extends { submissionUuid?: string }>(
  { tag, query, field, input }: { tag: string; query: string; field: string; input: object },
  { endpoint = process.env.MYTWIN_BACKEND_GRAPHQL_URL, fetchImpl = fetch }: CrmOptions,
): Promise<T | null> {
  if (!endpoint) {
    console.warn(`[crm:${tag}] MYTWIN_BACKEND_GRAPHQL_URL is not set, the request is not recorded`);
    return null;
  }

  try {
    const res = await fetchImpl(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables: { input } }),
      cache: "no-store",
      signal: AbortSignal.timeout(CRM_TIMEOUT_MS),
    });
    const payload = (await res.json().catch(() => null)) as CrmResponse<T> | null;
    const result = payload?.data?.[field];
    if (result?.submissionUuid) return result;

    console.error(`[crm:${tag}] HTTP ${res.status}`, payload?.errors?.[0]?.message ?? "");
    return null;
  } catch (error) {
    console.error(`[crm:${tag}]`, error instanceof Error ? error.message : error);
    return null;
  }
}

/** Dépose la demande de rendez-vous ; rend l'uuid de la soumission, ou `null`. */
export async function submitBookingRequest(request: BookingRequest, options: CrmOptions = {}): Promise<string | null> {
  const result = await submit<{ submissionUuid: string }>(
    {
      tag: `booking:${request.source}`,
      query: SUBMIT_BOOKING_REQUEST,
      field: "crmSubmitBookingRequest",
      input: request,
    },
    options,
  );
  return result?.submissionUuid ?? null;
}

/** Inscrit le visiteur au Lab ; rend la soumission, ou `null`. */
export async function submitLabJoin(request: LabJoinRequest, options: CrmOptions = {}): Promise<LabJoinResult | null> {
  return submit<LabJoinResult>({ tag: "join", query: SUBMIT_LAB_JOIN, field: "crmSubmitLabJoin", input: request }, options);
}
