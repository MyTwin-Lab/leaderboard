"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import {
  ANECDOTE_CONSENT_VERSION,
  ANECDOTE_MAX_LENGTH,
  JOIN_CONSENT_VERSION,
  JOIN_UTM,
  JOIN_PATH,
  JOIN_WELCOME_PATH,
  parseLabRole,
} from "@/lib/join";
import { submitLabJoin, submitStory } from "@/lib/server/crm";
import { readLabMember, writeLabMember } from "@/lib/server/labMember";

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

  // Le même e-mail retrouve ses pas ; un autre e-mail sur ce navigateur
  // repart de zéro.
  const current = await readLabMember();
  await writeLabMember({ email, steps: current?.email === email ? current.steps : [] });

  return { returning: result?.isFirstOfKind === false };
}

export type ShareAnecdoteState = {
  error?: "empty" | "consent" | "server";
};

const contentSchema = z.string().trim().min(1).max(ANECDOTE_MAX_LENGTH);

/**
 * L'anecdote de `/join/share`, rattachée au membre par son cookie. Envoyée, le
 * pas « anecdote » se coche et le membre revient sur sa page d'accueil.
 */
export async function shareAnecdote(_prev: ShareAnecdoteState, formData: FormData): Promise<ShareAnecdoteState> {
  const member = await readLabMember();
  if (!member) redirect(JOIN_PATH);

  if (formData.get("website")) redirect(`${JOIN_WELCOME_PATH}?shared=1`);

  const content = contentSchema.safeParse(formData.get("content"));
  if (!content.success) return { error: "empty" };
  if (formData.get("consent") !== "on") return { error: "consent" };

  const recorded = await submitStory({
    email: member.email,
    content: content.data,
    consentVersion: ANECDOTE_CONSENT_VERSION,
  });
  if (!recorded) return { error: "server" };

  await writeLabMember({ ...member, steps: [...member.steps, "anecdote"] });
  redirect(`${JOIN_WELCOME_PATH}?shared=1`);
}

/**
 * Coche le pas WhatsApp, qui se fait ailleurs. Le clic suffit : le Lab ne
 * saura jamais si la personne a vraiment rejoint le groupe, et ne cherche pas
 * à le savoir.
 */
export async function markWhatsappJoined(): Promise<void> {
  const member = await readLabMember();
  if (!member || member.steps.includes("whatsapp")) return;
  await writeLabMember({ ...member, steps: [...member.steps, "whatsapp"] });
}
