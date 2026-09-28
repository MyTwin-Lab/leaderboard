import { z } from "zod";
import type { ActionContext } from "../../../packages/registry/platform.js";
import {
  ChallengeSignalRepository,
  ChallengeSlackConfigRepository,
} from "../../../packages/database-service/repositories/index.js";

/**
 * Actions de l'extension slack-signals. L'accès est déclaré dans `index.ts` ;
 * ici, seulement ce qui tient aux lignes elles-mêmes (un signal appartient à
 * ce challenge, le corps est valide).
 */

const signalRepo = new ChallengeSignalRepository();
const slackConfigRepo = new ChallengeSlackConfigRepository();

const createSignalSchema = z.object({
  label: z.string().min(1).max(120),
  description: z.string().optional(),
  reward_cp: z.number().int().nonnegative(),
  icon: z.string().max(32).nullish(),
  position: z.number().int().nonnegative().optional(),
});

const updateSignalSchema = z.object({
  label: z.string().min(1).max(120).optional(),
  description: z.string().optional(),
  reward_cp: z.number().int().nonnegative().optional(),
  icon: z.string().max(32).nullish(),
  position: z.number().int().nonnegative().optional(),
});

const upsertConfigSchema = z.object({
  channel_id: z.string().min(1).max(32),
  channel_name: z.string().max(120).nullish(),
});

function validationError(error: z.ZodError) {
  return Response.json({ error: "Validation error", details: error.issues }, { status: 400 });
}

/** Le signal `signalId`, s'il appartient bien à ce challenge. */
async function signalOfChallenge({ challenge, params }: ActionContext) {
  const existing = await signalRepo.findById(params.signalId);
  return existing && existing.challenge_id === challenge.uuid ? existing : null;
}

const signalNotFound = () => Response.json({ error: "Signal not found" }, { status: 404 });

/** `GET signals` — les signaux définis sur le challenge. */
export async function listSignals({ challenge }: ActionContext) {
  return signalRepo.findByChallenge(challenge.uuid);
}

/** `POST signals` — définir un signal. */
export async function createSignal({ request, challenge }: ActionContext) {
  const parsed = createSignalSchema.safeParse(await request.json());
  if (!parsed.success) return validationError(parsed.error);

  const signal = await signalRepo.create({
    challenge_id: challenge.uuid,
    label: parsed.data.label,
    description: parsed.data.description,
    reward_cp: parsed.data.reward_cp,
    icon: parsed.data.icon ?? null,
    position: parsed.data.position ?? 0,
  });
  return Response.json(signal, { status: 201 });
}

/** `PUT signals/:signalId` — modifier un signal. */
export async function updateSignal(ctx: ActionContext) {
  if (!(await signalOfChallenge(ctx))) return signalNotFound();

  const parsed = updateSignalSchema.safeParse(await ctx.request.json());
  if (!parsed.success) return validationError(parsed.error);
  return signalRepo.update(ctx.params.signalId, parsed.data);
}

/** `DELETE signals/:signalId` — supprimer un signal. */
export async function deleteSignal(ctx: ActionContext) {
  if (!(await signalOfChallenge(ctx))) return signalNotFound();

  await signalRepo.delete(ctx.params.signalId);
  return { success: true };
}

/** `GET config` — le canal Slack écouté, ou `null`. */
export async function getConfig({ challenge }: ActionContext) {
  return slackConfigRepo.findByChallenge(challenge.uuid);
}

/** `PUT config` — choisir le canal Slack écouté. */
export async function saveConfig({ request, challenge }: ActionContext) {
  const parsed = upsertConfigSchema.safeParse(await request.json());
  if (!parsed.success) return validationError(parsed.error);

  return slackConfigRepo.upsert({
    challenge_id: challenge.uuid,
    channel_id: parsed.data.channel_id,
    channel_name: parsed.data.channel_name ?? null,
  });
}

/** `DELETE config` — ne plus écouter de canal. */
export async function deleteConfig({ challenge }: ActionContext) {
  await slackConfigRepo.delete(challenge.uuid);
  return { success: true };
}
