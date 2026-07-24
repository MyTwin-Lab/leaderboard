import {
  ChallengeRepository,
  ChallengeTeamRepository,
  ChallengeSignalRepository,
  ChallengeSlackConfigRepository,
  ContributionRepository,
  ProjectRepository,
  RewardEntryRepository,
} from '../../database-service/repositories/index.js';
import type { RewardEntryDraft } from '../../database-service/repositories/index.js';
import { getSlackToken } from '../../config/slackCredentials.js';
import { SlackConnector } from '../../connectors/implementation/Slack.connector.js';
import { runDetectAgent } from '../../slack-signal-agent/index.js';
import type { SlackSignalContext, SlackSignalMessage } from '../../slack-signal-agent/index.js';

/**
 * Nombre maximum de messages envoyés au LLM par run. Au-delà, les messages
 * excédentaires (les plus récents) sont laissés pour le run suivant : le
 * curseur n'avance que jusqu'au dernier message réellement analysé.
 */
const MAX_MESSAGES_PER_RUN = 300;

export interface SlackSignalsRunSummary {
  challengeId: string;
  status: 'skipped' | 'no_new_messages' | 'processed' | 'failed';
  reason?: string;
  messageCount?: number;
  detectionCount?: number;
  awardedCount?: number;
}

/**
 * SlackSignalsService
 * -------------------
 * Ingestion quotidienne des messages Slack d'un challenge : fetch depuis le
 * curseur, résolution des auteurs par email, détection LLM des signaux
 * définis sur le challenge, puis écriture dans le ledger `reward_entries`
 * (rule_key `slack_signal`, hors pool) via une contribution `discussion`
 * unique par participant.
 */
export class SlackSignalsService {
  private challengeRepo = new ChallengeRepository();
  private teamRepo = new ChallengeTeamRepository();
  private signalRepo = new ChallengeSignalRepository();
  private configRepo = new ChallengeSlackConfigRepository();
  private contributionRepo = new ContributionRepository();
  private projectRepo = new ProjectRepository();
  private rewardRepo = new RewardEntryRepository();

  async processChallenge(challengeId: string): Promise<SlackSignalsRunSummary> {
    const challenge = await this.challengeRepo.findById(challengeId);
    if (!challenge || challenge.status !== 'active') {
      return { challengeId, status: 'skipped', reason: 'challenge not active' };
    }

    const config = await this.configRepo.findByChallenge(challengeId);
    if (!config) {
      return { challengeId, status: 'skipped', reason: 'no slack config' };
    }

    const signals = await this.signalRepo.findByChallenge(challengeId);
    if (signals.length === 0) {
      return { challengeId, status: 'skipped', reason: 'no signals defined' };
    }

    const token = await getSlackToken();
    if (!token) {
      console.warn(`[SlackSignals] Challenge ${challengeId}: Slack is not connected, skipping`);
      return { challengeId, status: 'skipped', reason: 'slack not connected' };
    }

    try {
      const connector = new SlackConnector({ token, channelId: config.channel_id });

      const items = await connector.fetchItems({
        oldest: config.last_ts ?? undefined,
        maxMessages: MAX_MESSAGES_PER_RUN,
      });

      if (items.length === 0) {
        await this.configRepo.updateCursor(challengeId, { last_run_at: new Date(), last_error: null });
        return { challengeId, status: 'no_new_messages', messageCount: 0 };
      }

      // Résolution des auteurs par email, contre l'équipe du challenge.
      const teamMembers = await this.teamRepo.findTeamMembers(challengeId);
      const membersByEmail = new Map(
        teamMembers
          .filter((m) => m.email)
          .map((m) => [m.email!.toLowerCase(), m])
      );

      const authorIds = [...new Set(items.map((i) => String(i.metadata!.user)))];
      const authors = new Map<string, { user_id: string | null; name: string }>();
      const unresolved: string[] = [];
      for (const slackUserId of authorIds) {
        const profile = await connector.resolveUserProfile(slackUserId);
        const member = profile.email ? membersByEmail.get(profile.email.toLowerCase()) : undefined;
        authors.set(slackUserId, {
          user_id: member?.uuid ?? null,
          name: member?.full_name ?? profile.name ?? slackUserId,
        });
        if (!member) unresolved.push(`${profile.name ?? slackUserId} (${profile.email ?? 'no email'})`);
      }
      if (unresolved.length > 0) {
        console.warn(`[SlackSignals] Challenge ${challengeId}: unresolved authors: ${unresolved.join(', ')}`);
      }

      const messages: SlackSignalMessage[] = items.map((item) => {
        const author = authors.get(String(item.metadata!.user))!;
        return {
          ts: String(item.metadata!.ts),
          author_user_id: author.user_id,
          author_name: author.name,
          text: String(item.metadata!.text),
        };
      });

      const project = challenge.project_id
        ? await this.projectRepo.findById(challenge.project_id)
        : null;

      const context: SlackSignalContext = {
        challenge: {
          title: challenge.title,
          description: challenge.description || undefined,
          roadmap: challenge.roadmap || undefined,
        },
        project_title: project?.title,
        participants: teamMembers.map((m) => ({ user_id: m.uuid, full_name: m.full_name })),
        signals: signals.map((s) => ({
          signal_id: s.uuid,
          label: s.label,
          description: s.description,
          reward_cp: s.reward_cp,
        })),
        messages,
      };

      const { detections } = await runDetectAgent(context);

      // Déduplication contre le ledger : si un run précédent a crashé entre
      // l'écriture et l'avancement du curseur, les mêmes messages reviennent.
      const existingEntries = await this.rewardRepo.findByChallenge(challengeId);
      const alreadyAwarded = new Set(
        existingEntries
          .filter((e) => e.rule_key === 'slack_signal')
          .map((e) => `${e.user_id}|${e.meta?.signal_id}|${e.meta?.message_ts}`)
      );

      const signalById = new Map(signals.map((s) => [s.uuid, s]));
      const newDetections = detections.filter(
        (d) => !alreadyAwarded.has(`${d.user_id}|${d.signal_id}|${d.message_ts}`)
      );

      let awardedCount = 0;
      if (newDetections.length > 0) {
        // Une contribution `discussion` par participant, alimentée par le ledger.
        const detectedUserIds = [...new Set(newDetections.map((d) => d.user_id))];
        const challengeContributions = await this.contributionRepo.findByChallenge(challengeId);
        const contributionByUser = new Map<string, string>();

        for (const userId of detectedUserIds) {
          const existing = challengeContributions.find(
            (c) => c.type === 'discussion' && c.user_id === userId
          );
          if (existing) {
            contributionByUser.set(userId, existing.uuid);
          } else {
            const created = await this.contributionRepo.create({
              title: `Slack discussion — #${config.channel_name ?? config.channel_id}`,
              type: 'discussion',
              description: 'Contribution signals detected in Slack discussions',
              reward: 0,
              user_id: userId,
              challenge_id: challengeId,
              evaluation_status: 'done',
              submitted_at: new Date(),
            });
            contributionByUser.set(userId, created.uuid);
          }
        }

        const textByTs = new Map(messages.map((m) => [m.ts, m.text]));
        const drafts: RewardEntryDraft[] = newDetections.map((d) => {
          const signal = signalById.get(d.signal_id)!;
          return {
            challenge_id: challengeId,
            user_id: d.user_id,
            contribution_id: contributionByUser.get(d.user_id)!,
            rule_key: 'slack_signal',
            points: signal.reward_cp,
            meta: {
              signal_id: d.signal_id,
              signal_label: signal.label,
              message_ts: d.message_ts,
              channel_id: config.channel_id,
              excerpt: (textByTs.get(d.message_ts) ?? '').slice(0, 200),
              justification: d.justification,
            },
          };
        });

        const inserted = await this.rewardRepo.createManyAndSyncRewards(drafts);
        awardedCount = inserted.length;
      }

      // Le curseur n'avance que jusqu'au dernier message effectivement analysé.
      const lastTs = messages[messages.length - 1].ts;
      await this.configRepo.updateCursor(challengeId, {
        last_ts: lastTs,
        last_run_at: new Date(),
        last_error: null,
      });

      console.log(
        `[SlackSignals] Challenge ${challengeId}: ${messages.length} message(s), ` +
        `${detections.length} detection(s), ${awardedCount} awarded`
      );

      return {
        challengeId,
        status: 'processed',
        messageCount: messages.length,
        detectionCount: detections.length,
        awardedCount,
      };
    } catch (error: any) {
      // Échec : on enregistre l'erreur sans toucher au curseur, la fenêtre
      // sera rejouée au prochain run (la dédup ledger absorbe les doublons).
      await this.configRepo.updateCursor(challengeId, {
        last_run_at: new Date(),
        last_error: error?.message ?? String(error),
      }).catch(() => {});
      throw error;
    }
  }
}
