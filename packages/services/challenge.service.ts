import { OpenAIAgentEvaluator } from "../evaluator/evaluator.js";
import { Evaluation, ContributionReward } from "../evaluator/types.js";
import { computeRewards } from "../evaluator/reward.js";
import { 
  ChallengeRepository, 
  ContributionRepository, 
  ChallengeTeamRepository
} from "../database-service/repositories/index.js";
import type { User } from "../database-service/domain/entities.js";
import { GoogleDriveConnector } from "../connectors/implementation/GD.connector.js";
import { EvaluationGridRegistry } from "../evaluator/grids/index.js";
import { ConnectorRegistry } from "../connectors/registry.js";
import { ConnectorsOrchestrator } from "../connectors/connectors.orchestrator.js";
import type { ExternalConnector } from "../connectors/interfaces.js";
import { 
  IdentifyContext, 
  OldContribution, 
  EvaluateContext, 
  SnapshotInfo, 
  ModifiedFile,
  CommitInfo,
  UserInfo 
} from "../evaluator/types.js";
import { config } from "../config/index.js";

/**
 * ChallengeService
 * ----------------
 * Service d'orchestration pour gérer le cycle de vie complet d'un challenge:
 * - Sync Meeting: Identifier et scorer les contributions
 * - End of Challenge: Compute rewards et mise à jour du leaderboard
 */
export class ChallengeService {
  private evaluator: OpenAIAgentEvaluator;
  private challengeRepo: ChallengeRepository;
  private contributionRepo: ContributionRepository;
  private challengeTeamRepo: ChallengeTeamRepository;

  constructor() {
    this.evaluator = new OpenAIAgentEvaluator();
    this.challengeRepo = new ChallengeRepository();
    this.contributionRepo = new ContributionRepository();
    this.challengeTeamRepo = new ChallengeTeamRepository();
  }

  /**
   * Récupère les informations d'un challenge avec ses repos et son équipe
   */
  async getChallengeContext(challengeId: string) {
    const challenge = await this.challengeRepo.findById(challengeId);
    if (!challenge) {
      throw new Error(`[ChallengeService]Challenge ${challengeId} not found`);
    }

    const repos = await this.challengeRepo.findRepos(challengeId);
    const teamMembers = await this.challengeTeamRepo.findTeamMembers(challengeId);

    return { challenge, repos, teamMembers };
  }

  /**
   * Sync Meeting - Identifier et scorer les contributions
   * 
   * @param challengeId - ID du challenge actif
   * @returns Liste des évaluations effectuées
   */
  async runSyncEvaluation(
    challengeId: string
  ): Promise<Evaluation[]> {
    console.log(`\n🔄 [ChallengeService] Sync Evaluation pour challenge ${challengeId}`);

    // 1. Récupérer le contexte du challenge
    const { challenge, repos, teamMembers } = await this.getChallengeContext(challengeId);
    console.log(`   - Challenge: ${challenge.title}`);
    console.log(`   - Repos: ${repos.length}`);
    console.log(`   - Team: ${teamMembers.length} membres`);

    // 2. Initialiser les connecteurs (dynamique ou depuis env)
    const gdConnector = new GoogleDriveConnector({
      clientId: config.google.clientId || "",
      clientSecret: config.google.clientSecret || "",
      refreshToken: config.google.refreshToken || "",
      redirectUri: config.google.redirectUri || "http://localhost:3000/oauth/callback",
    });

    // Filtrer les repos de code (tout sauf google_drive qui est utilisé uniquement pour sync)
    const codeRepos = repos.filter(r => r.type !== 'google_drive'); //DELETE

    // Créer les connecteurs via le registre (générique, supporte github, huggingface, etc.)
    const connectors = codeRepos
      .map(repo => ConnectorRegistry.createConnector(repo))
      .filter((c): c is ExternalConnector => c !== null);

    if (connectors.length === 0) {
      console.warn("[ChallengeService] Aucun connecteur de code disponible, sync basé uniquement sur Google Drive");
    }

    // Initialiser l'orchestrateur pour gérer tous les connecteurs
    const orchestrator = new ConnectorsOrchestrator(connectors, codeRepos);
    await orchestrator.connectAll();

    // 3. Récupérer les données externes - Google Drive Sync
    await gdConnector.connect();
    const folderId = config.google.folderId || "";
    const itemsGD = await gdConnector.fetchItems({ 
      folderId,
      pageSize: 10, // Plus large pour être sûr d'avoir assez de fichiers
      orderBy: "modifiedTime desc"
    });

    // Filtrer les fichiers Sync (pas les dossiers, nom contient "Sync")
    const syncFiles = itemsGD.filter(item => 
      item.type !== 'folder' && 
      item.name.includes('Sync') &&
      item.name.includes(challenge.title)
    );

    let syncPreview = "";

    if (syncFiles.length === 0) {
      console.warn("[ChallengeService] Aucun fichier Sync trouvé dans Google Drive");
    } else {
      // Récupérer le contenu du dernier Sync
      const latestSync = syncFiles[0];
      const content = await gdConnector.fetchItemContent(latestSync.id);
      syncPreview = content.content;
      
      console.log(`[ChallengeService] Dernier Sync: ${latestSync.name} (${latestSync.metadata?.modifiedTime})`);
    }

    await gdConnector.disconnect();

    // Déterminer la période pour les commits basée sur les 2 derniers Syncs
    let commitOptions: any = { maxCommits: 30 };

    if (syncFiles.length >= 2) {
      // On a au moins 2 Syncs : utiliser la période entre les 2 derniers
      const latestSyncDate = syncFiles[0].metadata?.modifiedTime;
      const previousSyncDate = syncFiles[1].metadata?.modifiedTime;
      
      if (latestSyncDate && previousSyncDate) {
        commitOptions.since = previousSyncDate;
        commitOptions.until = latestSyncDate;
        console.log(`[ChallengeService] Période des commits: ${previousSyncDate} → ${latestSyncDate}`);
      }
    } else if (syncFiles.length === 1) {
      // Un seul Sync : prendre tous les commits depuis ce Sync
      const latestSyncDate = syncFiles[0].metadata?.modifiedTime;
      if (latestSyncDate) {
        commitOptions.since = latestSyncDate;
        console.log(`[ChallengeService] Commits depuis: ${latestSyncDate}`);
      }
    } else {
      console.log(`[ChallengeService] Aucune période définie, récupération des ${commitOptions.maxCommits} derniers commits`);
    }

    // Récupérer les items de tous les connecteurs (commits, etc.)
    const codeItems = await orchestrator.fetchAllItems(commitOptions);

    // Adapter les items en "commits" pour l'evaluator
    const commits = codeItems
      .filter(i => i.type === "commit")
      .map(i => ({
        id: i.id,
        message: i.metadata?.message || i.name,
        author: i.metadata?.authorLogin || i.metadata?.author,
        date: i.metadata?.date,
        sha: i.metadata?.sha || i.id,
        html_url: i.url,
      }));

    const context: IdentifyContext = {
      syncPreview,
      commits: commits.map(c => ({ ...c })), // Assure que ça match CommitInfo
      users: teamMembers.map((u: User) => ({
        uuid: u.uuid,
        full_name: u.full_name,
        github_username: u.github_username
      })),
      roadmap: challenge.roadmap
    };

    const contributions = await this.evaluator.identify(context);

    // 4. Identifier les contributions
    /*const contributions = await this.evaluator.identify({
      syncPreview,
      commits,
      users: teamMembers.map((u: User) => ({
        uuid: u.uuid,
        full_name: u.full_name,
        github_username: u.github_username
      })),
      roadmap: challenge.roadmap
    });*/

    console.log("[ChallengeService] ✅ ${contributions.length} contributions identifiées");
    console.log("[ChallengeService] Contributions identifiées :", contributions);

    const oldContributions = await this.contributionRepo.findByChallenge(challengeId);
    const sanitizedOldContributions: OldContribution[] = oldContributions.map(({
      challenge_id: _challengeId,
      evaluation: _evaluation,
      reward: _reward,
      ...rest
    }) => ({
      ...rest
    }));

    console.log("[ChallengeService] Contributions existantes :", sanitizedOldContributions);

    const mergedContributions = await this.evaluator.merge(contributions, sanitizedOldContributions);
    console.log("[ChallengeService] Contributions fusionnées :", mergedContributions);

    // Toujours créer mergedContributionsWithGrid, même sans anciennes contributions
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

    console.log("[ChallengeService] Contributions fusionnées avec grille précédente :", mergedContributionsWithGrid);

    // 5. Évaluer chaque contribution fusionnée
    const resolveConnector = (commitSha: string) => orchestrator.getConnectorForItem(commitSha);
    const evaluations: Evaluation[] = [];
    for (const item of mergedContributionsWithGrid) {
      const contribution = item.contribution;
      const commitShas = contribution.commitShas ?? [];
      if (commitShas.length === 0) {
        console.warn(`[ChallengeService] Contribution ${contribution.title} has no commitShas, skipping evaluation`);
        continue;
      }

      const aggregatedSnapshot = await this.buildAggregatedSnapshot(resolveConnector, commitShas);
      if (!aggregatedSnapshot) {
        console.warn(`[ChallengeService] Unable to build aggregated snapshot for contribution ${contribution.title}`);
        continue;
      }

      const grid = EvaluationGridRegistry.getGrid(contribution.type);
      const preparedSnapshot = await this.prepareSnapshot(aggregatedSnapshot);
      const isUpdate = 'evaluation' in contribution && !!contribution.evaluation;
      
      try {
        const context: EvaluateContext = {
          snapshot: preparedSnapshot as SnapshotInfo, // Cast si nécessaire
          grid
        };

        const evaluation = await this.evaluator.evaluate(isUpdate, item, context);
        
        /*const evaluation = await this.evaluator.evaluate(isUpdate, item, {
          snapshot: preparedSnapshot,
          grid
        });*/

        evaluation.contribution = contribution;
        evaluations.push(evaluation);
      } catch (error) {
        console.error(`[ChallengeService] Error evaluating contribution ${contribution.title}:`, error);
      }
    }

    console.log(`[ChallengeService] ${evaluations.length} évaluations effectuées`);

    // 6. Sauvegarder en base de données
    await this.saveEvaluations(challengeId, evaluations);

    // 7. Déconnecter tous les connecteurs
    await orchestrator.disconnectAll();

    return evaluations;
  }

  /**
   * End of Challenge - Compute rewards et mise à jour du leaderboard
   * 
   * @param challengeId - ID du challenge à clôturer
   * @returns Liste des rewards distribués
   */
  async computeChallengeRewards(challengeId: string): Promise<ContributionReward[]> {
    console.log(`\n🏆 [ChallengeService] Compute Rewards pour challenge ${challengeId}`);

    // 1. Récupérer le challenge
    const challenge = await this.challengeRepo.findById(challengeId);
    if (!challenge) {
      throw new Error(`Challenge ${challengeId} not found`);
    }

    // 2. Récupérer toutes les contributions du challenge
    const contributions = await this.contributionRepo.findByChallenge(challengeId);
    console.log(`   - ${contributions.length} contributions trouvées`);

    // 3. Extraire les évaluations
    const evaluations: Evaluation[] = contributions
      .filter(c => c.evaluation)
      .map(c => c.evaluation as Evaluation);

    if (evaluations.length === 0) {
      console.warn("[ChallengeService] Aucune évaluation trouvée");
      return [];
    }

    // 4. Calculer les rewards
    const totalPool = challenge.contribution_points_reward;
    const rewards = computeRewards(evaluations, totalPool);

    console.log(`[ChallengeService] ${rewards.length} rewards calculés`);

    // 5. Mettre à jour les contributions avec les rewards
    for (const reward of rewards) {
      const contribution = contributions.find(c => 
        c.title === reward.contributionTitle
      );
      
      if (contribution) {
        try {
          await this.contributionRepo.update(contribution.uuid, {
            reward: reward.reward
          });
        } catch (error) {
          console.error(`[ChallengeService] Erreur lors de la mise à jour de la récompense pour ${contribution.title}:`, error);
          // Continuer
        }
      }
    }

    console.log(`[ChallengeService] Contributions mises à jour avec les rewards`);

    return rewards;
  }

  /**
   * Sauvegarde les évaluations en base de données
   */
  public async saveEvaluations(challengeId: string, evaluations: Evaluation[]): Promise<void> {
    for (const evaluation of evaluations) {
      if (!evaluation.contribution) continue;

      const contrib = evaluation.contribution;

      try {
        // Créer la contribution en DB
        await this.contributionRepo.create({
          title: contrib.title,
          type: contrib.type,
          description: contrib.description,
          evaluation: {
            scores: evaluation.scores,
            globalScore: evaluation.globalScore
          },
          tags: contrib.tags,
          reward: 0, // Sera calculé à la fin du challenge
          user_id: contrib.userId,
          challenge_id: challengeId,
        });
      } catch (error) {
        console.error(`[ChallengeService] Erreur lors de la sauvegarde de la contribution ${contrib.title}:`, error);
        // Continuer avec les autres
      }
    }

    console.log(`[ChallengeService] ${evaluations.length} contributions sauvegardées en DB`);
  }

  public async buildAggregatedSnapshot(
    resolveConnector: (commitSha: string) => ExternalConnector | undefined,
    commitShas: string[],
  ): Promise<SnapshotInfo | null> {
    const orderedShas = Array.from(new Set(commitShas));
    const uniqueFiles = new Map<string, ModifiedFile>();

    for (const commitSha of orderedShas) {
      const connector = resolveConnector(commitSha);
      if (!connector) {
        console.warn(`[ChallengeService] No connector found for commit ${commitSha}`);
        return null;
      }

      const snapshot = await connector.fetchItemContent(commitSha);
      const files : ModifiedFile[] = snapshot?.modifiedFiles ?? [];

      if (files.length === 0) {
        console.warn(`[ChallengeService] No modified files found for commit ${commitSha}`);
      }

      files.forEach((file: ModifiedFile) => {
        uniqueFiles.set(file.path, {
          ...file,
          lastSeenIn: commitSha,
        });
      });
    }

    if (uniqueFiles.size === 0) {
      return null;
    }

    return {
      snapshotId: orderedShas.join("_"),
      commitSha: orderedShas[orderedShas.length - 1],
      commitShas: orderedShas,
      modifiedFiles: Array.from(uniqueFiles.values()),
    };
  }

  /**
   * Prépare un snapshot pour l'évaluation en créant le workspace temporaire
   */
  public async prepareSnapshot(snapshot: SnapshotInfo): Promise<SnapshotInfo> {
    const fs = await import("fs/promises");
    const path = await import("path");
    const os = await import("os");

    const workspaceKey = snapshot.snapshotId ?? snapshot.commitSha ?? `${Date.now()}`;
    const baseDir = path.join(os.tmpdir(), "eval_agent", workspaceKey);
    await fs.mkdir(baseDir, { recursive: true });

    // Enregistrement local des fichiers modifiés
    if (snapshot.modifiedFiles) {
      await Promise.all(
        snapshot.modifiedFiles.map(async (f: any) => {
          const fullPath = path.join(baseDir, f.path);
          await fs.mkdir(path.dirname(fullPath), { recursive: true });
          await fs.writeFile(fullPath, f.content ?? "", "utf8");
        })
      );
    }
    
    // Retourner le snapshot allégé avec le chemin du workspace
    return {
      ...snapshot,
      modifiedFiles: snapshot.modifiedFiles?.map((f: any) => ({
        path: f.path,
        status: f.status,
        additions: f.additions,
        deletions: f.deletions,
      })),
      workspacePath: baseDir,
    };
  }
}