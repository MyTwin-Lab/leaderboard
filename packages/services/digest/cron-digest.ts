import { DigestRepository } from "../../database-service/repositories/index.js";
import { DigestService, digestFrequencyDays } from "./digest.service.js";
import { isDigestDue } from "./digest-schedule.js";

export interface DigestCronResult {
  generated: boolean;
  reason?: "not_due";
  digestId?: string;
  period?: { start: string; end: string };
}

/**
 * Contrôle quotidien du digest, lancé par le job `digest.generate`.
 *
 * Il n'y a pas de planification dynamique : le job tourne tous les jours, et
 * la décision de générer vit ici. Le curseur est la table `digests` elle-même.
 *
 * L'activation appartient au module digest (`module_settings`) : désactivé,
 * le tick saute ce job. Il ne reste ici que la fréquence.
 */
export async function runDigestCron(now = new Date()): Promise<DigestCronResult> {
  const frequencyDays = await digestFrequencyDays();
  const last = await new DigestRepository().findLatest();
  if (!isDigestDue(last?.period_end ?? null, now, frequencyDays)) {
    console.log(
      `[Cron] Digest not due yet (frequency ${frequencyDays}d, ` +
      `last period ended ${last?.period_end.toISOString() ?? "never"})`,
    );
    return { generated: false, reason: "not_due" };
  }

  const digest = await new DigestService().generate("cron", { now });
  console.log(
    `[Cron] Digest ${digest.uuid} generated over ` +
    `[${digest.period_start.toISOString()}, ${digest.period_end.toISOString()}]`,
  );
  return {
    generated: true,
    digestId: digest.uuid,
    period: {
      start: digest.period_start.toISOString(),
      end: digest.period_end.toISOString(),
    },
  };
}
