import {
  AppSettingsRepository,
  DigestRepository,
} from "../../database-service/repositories/index.js";
import { DigestService } from "./digest.service.js";
import { isDigestDue } from "./digest-schedule.js";

export interface DigestCronResult {
  generated: boolean;
  reason?: "disabled" | "not_due";
  digestId?: string;
  period?: { start: string; end: string };
}

/**
 * Contrôle quotidien du digest.
 *
 * Il n'y a pas de planification dynamique : le cron tourne tous les jours,
 * comme slack-signals, et la décision de générer vit ici. Le curseur est la
 * table `digests` elle-même.
 *
 * `digest_enabled` ne gouverne que ce chemin — la génération manuelle depuis
 * l'onglet admin fonctionne même désactivée (spec §8).
 */
export async function runDigestCron(now = new Date()): Promise<DigestCronResult> {
  const settings = await new AppSettingsRepository().get();
  if (!settings.digest_enabled) {
    console.log("[Cron] Digest disabled — skipping");
    return { generated: false, reason: "disabled" };
  }

  const last = await new DigestRepository().findLatest();
  if (!isDigestDue(last?.period_end ?? null, now, settings.digest_frequency_days)) {
    console.log(
      `[Cron] Digest not due yet (frequency ${settings.digest_frequency_days}d, ` +
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
