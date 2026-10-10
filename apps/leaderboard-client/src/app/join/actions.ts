"use server";

import { z } from "zod";

import { JOIN_CONSENT_VERSION, JOIN_UTM, parseLabRole } from "@/lib/join";
import { submitLabJoin } from "@/lib/server/crm";
import { writeLabMember } from "@/lib/server/labMember";

export type JoinLabResult = { returning: boolean } | { error: "invalid" };

const emailSchema = z.string().trim().toLowerCase().email().max(200);

/**
 * Le formulaire de `/join` : l'inscription entre au CRM, puis le navigateur
 * reçoit le cookie du membre, et le formulaire ouvre `/join/welcome`.
 *
 * Le CRM ne bloque jamais l'inscription : s'il ne répond pas, le visiteur est
 * accueilli quand même, comme sur `/book`. `returning` vient du CRM
 * (`isFirstOfKind`) ; sans réponse, on accueille un nouveau membre.
 *
 * Le champ `website` est un pot de miel : rempli, rien ne va au CRM et aucun
 * cookie n'est posé, mais la réponse reste la même.
 */
export async function joinLab(formData: FormData): Promise<JoinLabResult> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { error: "invalid" };

  if (formData.get("website")) return { returning: false };

  const email = parsed.data;
  const result = await submitLabJoin({
    email,
    role: parseLabRole(formData.get("role")),
    consentVersion: JOIN_CONSENT_VERSION,
    utm: JOIN_UTM,
  });

  await writeLabMember({ email });

  return { returning: result?.isFirstOfKind === false };
}
