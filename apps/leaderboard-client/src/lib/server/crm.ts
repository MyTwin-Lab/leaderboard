import "server-only";

import type { BookingCrmSource } from "@/lib/booking";

/**
 * Le CRM de MyTwin (MyTwinOS, package `crm`)
 * ------------------------------------------
 * Une seule porte, la mutation publique `crmSubmitBookingRequest` : le Lab ne
 * lit rien du CRM, il y dépose. `fetch` natif sur l'endpoint GraphQL du
 * backend, `MYTWIN_BACKEND_GRAPHQL_URL` — la même variable que
 * mytwin-health-landing.
 *
 * Ne lève jamais : un CRM absent, lent ou en erreur rend `null`, et le
 * visiteur part quand même sur Calendly. Perdre un rendez-vous parce que le
 * backend a eu un raté coûterait plus cher que la ligne CRM manquante, que les
 * `utm_*` de Calendly permettent de retrouver.
 */

export const CRM_TIMEOUT_MS = 5_000;

const SUBMIT_BOOKING_REQUEST = /* GraphQL */ `
  mutation CrmSubmitBookingRequest($input: CrmBookingRequestInput!) {
    crmSubmitBookingRequest(input: $input) {
      submissionUuid
    }
  }
`;

export interface BookingRequest {
  source: BookingCrmSource;
  firstName: string;
  email: string;
  utm: { source: string; medium: string; campaign: string };
}

interface SubmitBookingRequestResponse {
  data?: { crmSubmitBookingRequest?: { submissionUuid?: string } };
  errors?: { message: string }[];
}

/** Dépose la demande au CRM ; rend l'uuid de la soumission, ou `null`. */
export async function submitBookingRequest(
  request: BookingRequest,
  {
    endpoint = process.env.MYTWIN_BACKEND_GRAPHQL_URL,
    fetchImpl = fetch,
  }: { endpoint?: string; fetchImpl?: typeof fetch } = {},
): Promise<string | null> {
  if (!endpoint) {
    console.warn("[crm:booking] MYTWIN_BACKEND_GRAPHQL_URL is not set, the request is not recorded");
    return null;
  }

  try {
    const res = await fetchImpl(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: SUBMIT_BOOKING_REQUEST, variables: { input: request } }),
      cache: "no-store",
      signal: AbortSignal.timeout(CRM_TIMEOUT_MS),
    });
    const payload = (await res.json().catch(() => null)) as SubmitBookingRequestResponse | null;
    const submissionUuid = payload?.data?.crmSubmitBookingRequest?.submissionUuid;
    if (submissionUuid) return submissionUuid;

    console.error(`[crm:booking] ${request.source}: HTTP ${res.status}`, payload?.errors?.[0]?.message ?? "");
    return null;
  } catch (error) {
    console.error(`[crm:booking] ${request.source}:`, error instanceof Error ? error.message : error);
    return null;
  }
}
