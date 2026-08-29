import crypto from "crypto";
import { ChallengeService } from "./challenge.service.js";
import { RepoRepository, ChallengeRepository, ChallengeRepoRepository, ContributionRepository } from "../database-service/repositories/index.js";
import type { Challenge, User } from "../database-service/domain/entities.js";
import { OpenAIAgentEvaluator } from "../evaluator/evaluator.js";
import { ConnectorRegistry } from "../connectors/registry.js";
import { EvaluationGridRegistry } from "../evaluator/grids/index.js";
import type { Evaluation, IdentifyContext, OldContribution, EvaluateContext, SnapshotInfo } from "../evaluator/types.js";

/**
 * Interface pour le payload GitHub Pull Request
 */
export interface GitHubPullRequestPayload {
  action: string;
  number: number;
  pull_request: {
    number: number;
    html_url: string;
    merged: boolean;
    merged_at: string | null;
    base: {
      ref: string; // Branche cible (ex: "main")
    };
    head: {
      ref: string; // Branche source (ex: "feature/xxx")
    };
  };
  repository: {
    full_name: string; // Format "owner/repo"
    name: string;
  };
}

/**
 * Interface pour les données de Pull Request
 */
export interface PRData {
  prNumber: number;
  prUrl: string;
  prBranch: string;
  baseBranch: string;
  headBranch: string;
  repoId: string;
  repoExternalId: string;
  mergedAt: string;
}

/**
 * WebhookService
 * --------------
 * Service de gestion des webhooks GitHub pour automatiser l'identification des contributions.
 * 
 * Responsabilités:
 * - Valider la signature HMAC SHA-256 des webhooks GitHub
 * - Router les événements vers les handlers appropriés
 * - Traiter les pull_request.closed (merged=true)
 * - Identifier les challenges actifs liés au repo
 * - Déléguer l'évaluation à ChallengeService
 */
export class WebhookService {
  private challengeService: ChallengeService;
  private repoRepo: RepoRepository;
  private challengeRepo: ChallengeRepository;
  private challengeRepoRepo: ChallengeRepoRepository;

  constructor() {
    this.challengeService = new ChallengeService();
    this.repoRepo = new RepoRepository();
    this.challengeRepo = new ChallengeRepository();
    this.challengeRepoRepo = new ChallengeRepoRepository();
  }

  /**
   * Valide la signature HMAC SHA-256 du webhook GitHub
   * @param payload - Payload du webhook (string JSON)
   * @param signature - Signature du header x-hub-signature-256
   * @param secret - Secret partagé avec GitHub
   * @returns true si la signature est valide
   */
  validateGitHubSignature(payload: string, signature: string, secret: string): boolean {
    if (!signature || !secret) {
      return false;
    }

    const hmac = crypto.createHmac("sha256", secret);
    const digest = "sha256=" + hmac.update(payload).digest("hex");

    // Utiliser timingSafeEqual pour éviter les timing attacks
    try {
      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
    } catch {
      return false;
    }
  }

  /**
   * Traite un événement pull_request de GitHub
   * @param payload - Payload du webhook
   */
  async handlePullRequest(payload: GitHubPullRequestPayload): Promise<void> {
    console.log(`\n🔔 [WebhookService] Pull Request event received`);
    console.log(`   - Action: ${payload.action}`);
    console.log(`   - PR #${payload.number}: ${payload.pull_request.html_url}`);
    console.log(`   - Merged: ${payload.pull_request.merged}`);

    // Traiter uniquement les PR mergées
    if (payload.action !== "closed" || !payload.pull_request.merged) {
      console.log(`[WebhookService] ⏭ Ignoring: not a merged PR`);
      return;
    }

    const repoExternalId = payload.repository.full_name;
    const prNumber = payload.pull_request.number;
    const prUrl = payload.pull_request.html_url;
    const prBranch = payload.pull_request.head.ref;
    const baseBranch = payload.pull_request.base.ref;
    const mergedAt = payload.pull_request.merged_at;

    console.log(`   - Repository: ${repoExternalId}`);
    console.log(`   - Branch: ${prBranch} → ${baseBranch}`);

    // 1. Trouver le repo en DB via external_repo_id
    const repo = await this.findRepoByExternalId(repoExternalId);
    if (!repo) {
      console.warn(`[WebhookService] Repository ${repoExternalId} not found in database`);
      return;
    }

    console.log(`[WebhookService] Repo found: ${repo.title} (${repo.uuid})`);

    // 2. Trouver les challenges actifs liés à ce repo
    const activeChallenges = await this.findActiveChallengesForRepo(repo.uuid);
    if (activeChallenges.length === 0) {
      console.log(`[WebhookService] No active challenges for this repository`);
      return;
    }

    console.log(`[WebhookService] ${activeChallenges.length} active challenge(s) found`);

    // 3. Évaluer les contributions pour chaque challenge actif
    for (const challenge of activeChallenges) {
      console.log(`\n[WebhookService] Processing challenge: ${challenge.title}`);
      
      try {
        await this.runPRContributionEvaluation(challenge.uuid, {
          prNumber,
          prUrl,
          prBranch,
          baseBranch,
          headBranch: prBranch,
          repoId: repo.uuid,
          repoExternalId,
          mergedAt: mergedAt || new Date().toISOString(),
        });

        console.log(`[WebhookService] Challenge ${challenge.title} processed successfully`);
      } catch (error: any) {
        console.error(`[WebhookService] Error processing challenge ${challenge.title}:`, error.message);
        // Continue avec les autres challenges même en cas d'erreur
      }
    }

    console.log(`\n[WebhookService] Pull Request processing completed`);
  }

  /**
   * Trouve un repo en DB via son external_repo_id (format "owner/repo")
   * @param externalRepoId - Format "owner/repo" (ex: "MyTwin-Lab/MyTwinLeaderboard")
   * @returns Repo ou null si non trouvé
   */
  private async findRepoByExternalId(externalRepoId: string) {
    return await this.repoRepo.findByExternalId(externalRepoId);
  }

  /**
   * Trouve les challenges actifs liés à un repo
   * @param repoId - UUID du repo
   * @returns Liste des challenges actifs
   */
  private async findActiveChallengesForRepo(repoId: string): Promise<Challenge[]> {
    // 1. Trouver tous les liens challenge-repo pour ce repo
    const challengeRepoLinks = await this.challengeRepoRepo.findByRepo(repoId);
    
    if (challengeRepoLinks.length === 0) {
      return [];
    }

    // 2. Récupérer les challenges correspondants et filtrer les actifs
    const activeChallenges: Challenge[] = [];
    
    for (const link of challengeRepoLinks) {
      const challenge = await this.challengeRepo.findById(link.challenge_id);
      
      if (challenge && challenge.status === "active") {
        activeChallenges.push(challenge);
      }
    }

    return activeChallenges;
  }

  /**
   * PR Contribution Evaluation - Identifier et scorer les contributions d'une Pull Request
   * 
   * Cette méthode est déclenchée automatiquement lors d'une PR mergée.
   * Elle récupère tous les commits de la branche de la PR et les évalue.
   * 
   * @param challengeId - ID du challenge actif
   * @param prData - Données de la Pull Request
   * @returns Liste des évaluations effectuées
   */
  async runPRContributionEvaluation(
    challengeId: string,
    prData: PRData
  ): Promise<Evaluation[]> {
    console.log(`\n🔄 [WebhookService] PR Contribution Evaluation pour challenge ${challengeId}`);
    console.log(`   - PR #${prData.prNumber}: ${prData.prUrl}`);
    console.log(`   - Branch: ${prData.prBranch} → ${prData.baseBranch}`);
    console.log(`   - Repo: ${prData.repoExternalId}`);

    // 1. Récupérer le contexte du challenge via ChallengeService
    const { challenge, repos, teamMembers } = await this.challengeService.getChallengeContext(challengeId);
    console.log(`   - Challenge: ${challenge.title}`);
    console.log(`   - Team: ${teamMembers.length} membres`);

    // 2. Trouver le repo concerné dans la liste des repos du challenge
    const targetRepo = repos.find((r: any) => r.uuid === prData.repoId);
    if (!targetRepo) {
      throw new Error(`Repo ${prData.repoId} not found in challenge ${challengeId}`);
    }

    console.log(`   - Target repo: ${targetRepo.title} (${targetRepo.type})`);

    // 3. Créer le connecteur pour ce repo spécifique
    const connector = await ConnectorRegistry.createConnector(targetRepo);

    if (!connector) {
      throw new Error(`No connector available for repo type: ${targetRepo.type}`);
    }

    await connector.connect();

    // 4. Récupérer TOUS les commits de la branche de la PR
    console.log(`[WebhookService] Fetching commits from branch ${prData.headBranch}...`);
    
    const items = await connector.fetchItems({ 
      baseBranch: prData.baseBranch,
      headBranch: prData.headBranch
    });
    
    // Adapter les items en "commits" pour l'evaluator
    const commits = items
      .filter(i => i.type === "commit")
      .map(i => ({
        id: i.id,
        message: i.metadata?.message || i.name,
        author: i.metadata?.authorLogin || i.metadata?.author,
        date: i.metadata?.date,
        sha: i.metadata?.sha || i.id,
        html_url: i.url,
      }));

    console.log(`[WebhookService] ${commits.length} commits récupérés`);

    // 5. Identifier les contributions (pas de syncPreview pour les PRs)
    const evaluator = new OpenAIAgentEvaluator();
    const context: IdentifyContext = {
      syncPreview: `Pull Request #${prData.prNumber}: ${prData.prBranch} → ${prData.baseBranch}\nMerged at: ${prData.mergedAt}`,
      commits: commits.map(c => ({ ...c })),
      users: teamMembers.map((u: User) => ({
        uuid: u.uuid,
        full_name: u.full_name,
        github_username: u.github_username
      })),
      roadmap: challenge.roadmap
    };

    const contributions = await evaluator.identify(context);
    console.log(`[WebhookService] ${contributions.length} contributions identifiées`);

    // 6. Récupérer les anciennes contributions pour le merge
    const contributionRepo = new ContributionRepository();
    const oldContributions = await contributionRepo.findByChallenge(challengeId);
    const sanitizedOldContributions: OldContribution[] = oldContributions.map(({
      challenge_id: _challengeId,
      evaluation: _evaluation,
      reward: _reward,
      ...rest
    }) => ({
      ...rest
    }));

    const mergedContributions = await evaluator.merge(contributions, sanitizedOldContributions);
    console.log(`[WebhookService] ${mergedContributions.length} contributions fusionnées`);

    // Ajouter les évaluations précédentes si elles existent
    const oldContributionById = new Map(
      oldContributions.map(oldContribution => [oldContribution.uuid, oldContribution])
    );

    const mergedContributionsWithGrid = mergedContributions.map(mergedContribution => {
      const matchingOldContribution = oldContributionById.get(mergedContribution.oldContributionId);
      if (!matchingOldContribution?.evaluation) {
        return mergedContribution;
      }

      return {
        ...mergedContribution,
        contribution: {
          ...mergedContribution.contribution,
          evaluation: matchingOldContribution.evaluation,
        },
      };
    });

    // 7. Évaluer chaque contribution fusionnée
    const resolveConnector = (commitSha: string) => connector;
    const evaluations: Evaluation[] = [];

    for (const item of mergedContributionsWithGrid) {
      const contribution = item.contribution;
      const commitShas = contribution.commitShas ?? [];
      
      if (commitShas.length === 0) {
        console.warn(`[WebhookService]  Contribution ${contribution.title} has no commitShas, skipping evaluation`);
        continue;
      }

      // Utiliser la méthode publique de ChallengeService pour construire le snapshot
      const aggregatedSnapshot = await this.challengeService.buildAggregatedSnapshot(resolveConnector, commitShas);
      if (!aggregatedSnapshot) {
        console.warn(`[WebhookService]  Unable to build aggregated snapshot for contribution ${contribution.title}`);
        continue;
      }

      const grid = EvaluationGridRegistry.getGrid(contribution.type);
      const preparedSnapshot = await this.challengeService.prepareSnapshot(aggregatedSnapshot);
      const isUpdate = 'evaluation' in contribution && !!contribution.evaluation;
      
      try {
        const evalContext: EvaluateContext = {
          snapshot: preparedSnapshot as SnapshotInfo,
          grid
        };

        const evaluation = await evaluator.evaluate(isUpdate, item, evalContext);
        evaluation.contribution = contribution;
        evaluations.push(evaluation);
      } catch (error: any) {
        console.error(`[WebhookService] Error evaluating contribution ${contribution.title}:`, error.message);
      }
    }

    console.log(`[WebhookService] ${evaluations.length} évaluations effectuées pour la PR ${prData.prNumber}`);

    // 8. Sauvegarder en base de données via ChallengeService
    await this.challengeService.saveEvaluations(challengeId, evaluations);

    // 9. Déconnecter le connecteur
    if (connector && typeof connector.disconnect === 'function') {
      await connector.disconnect();
    }

    console.log(`\n[WebhookService] PR Contribution Evaluation completed`);

    return evaluations;
  }

  /**
   * Vérifie si une PR a déjà été traitée (idempotence)
   * Note: Pour l'instant, cette méthode retourne toujours false
   * car nous n'avons pas encore la table webhook_events.
   * À implémenter dans la Phase 1.
   * 
   * @param prNumber - Numéro de la PR
   * @param repoExternalId - Format "owner/repo"
   * @returns true si déjà traitée
   */
  async isPRAlreadyProcessed(prNumber: number, repoExternalId: string): Promise<boolean> {
    // TODO Phase 1: Vérifier dans la table webhook_events
    // const existing = await webhookEventRepo.findByPRNumber(prNumber, repoExternalId);
    // return existing !== null && existing.status === 'processed';
    
    console.log(`   ℹ️  Idempotence check not yet implemented (Phase 1 pending)`);
    return false;
  }
}
