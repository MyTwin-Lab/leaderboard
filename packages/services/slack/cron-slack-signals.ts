import { ChallengeSlackConfigRepository } from '../../database-service/repositories/index.js';
import { SlackSignalsService, type SlackSignalsRunSummary } from './slack-signals.service.js';

export async function runSlackSignalsCron(): Promise<SlackSignalsRunSummary[]> {
  const configRepo = new ChallengeSlackConfigRepository();
  const service = new SlackSignalsService();

  const configs = await configRepo.findAllConfigured();
  console.log(`[Cron] Checking ${configs.length} challenge(s) with a Slack channel`);

  const summaries: SlackSignalsRunSummary[] = [];
  for (const config of configs) {
    try {
      summaries.push(await service.processChallenge(config.challenge_id));
    } catch (error) {
      console.error(`[Cron] Slack signals failed for challenge ${config.challenge_id}:`, error);
      summaries.push({ challengeId: config.challenge_id, status: 'failed' });
    }
  }
  return summaries;
}
