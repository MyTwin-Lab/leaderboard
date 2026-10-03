"use server";

import { z } from "zod";

import { bookingCrmSource, bookingUtm, calendlyBookingUrl, parseBookingIntent } from "@/lib/booking";
import { submitBookingRequest } from "@/lib/server/crm";

export type StartBookingResult = { url: string } | { error: "invalid" };

const schema = z.object({
  firstName: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().email().max(200),
});

/**
 * Le formulaire de `/book` : la demande entre au CRM, puis le visiteur part
 * sur Calendly avec l'URL rendue ici, `utm_content` = la soumission CRM.
 *
 * L'intention arrive du client : elle est relue contre la liste fermée, jamais
 * transmise telle quelle. Le champ `website` est un pot de miel, invisible pour
 * un humain : rempli, la demande ne va pas au CRM, mais la réponse reste la
 * même — un robot n'a rien à apprendre de ce qui l'a trahi.
 */
export async function startBooking(rawIntent: unknown, formData: FormData): Promise<StartBookingResult> {
  const parsed = schema.safeParse({
    firstName: formData.get("firstName"),
    email: formData.get("email"),
  });
  if (!parsed.success) return { error: "invalid" };

  const intent = parseBookingIntent(rawIntent);
  const { firstName, email } = parsed.data;
  const isBot = Boolean(formData.get("website"));

  const submissionUuid = isBot
    ? null
    : await submitBookingRequest({
        source: bookingCrmSource(intent),
        firstName,
        email,
        utm: bookingUtm(intent),
      });

  return { url: calendlyBookingUrl({ firstName, email, intent, submissionUuid }) };
}
