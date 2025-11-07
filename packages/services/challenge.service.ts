import { OpenAIAgentEvaluator } from "../evaluator/evaluator.js";
import { Evaluation, ContributionReward } from "../evaluator/types.js";
import { computeRewards } from "../evaluator/reward.js";
import { 
  ChallengeRepository, 
  ContributionRepository, 
  UserRepository,
  ChallengeTeamRepository,
  RepoRepository
} from "../database-service/repositories/index.js";
import type { Challenge, User, Contribution as DBContribution } from "../database-service/domain/entities.js";
import { GoogleDriveConnector } from "../connectors/implementation/GD.connector.js";
import { EvaluationGridRegistry } from "../evaluator/grids/index.js";
import { ConnectorRegistry } from "../connectors/registry.js";
import { ConnectorsOrchestrator } from "../connectors/connectors.orchestrator.js";
import type { ExternalConnector } from "../connectors/interfaces.js";

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
  private userRepo: UserRepository;
  private challengeTeamRepo: ChallengeTeamRepository;
  private repoRepo: RepoRepository;

  constructor() {
    this.evaluator = new OpenAIAgentEvaluator();
    this.challengeRepo = new ChallengeRepository();
    this.contributionRepo = new ContributionRepository();
    this.userRepo = new UserRepository();
    this.challengeTeamRepo = new ChallengeTeamRepository();
    this.repoRepo = new RepoRepository();
  }

  /**
   * Récupère les informations d'un challenge avec ses repos et son équipe
   */
  async getChallengeContext(challengeId: string) {
    const challenge = await this.challengeRepo.findById(challengeId);
    if (!challenge) {
      throw new Error(`Challenge ${challengeId} not found`);
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
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      refreshToken: process.env.GOOGLE_REFRESH_TOKEN || "",
      redirectUri: process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/oauth/callback",
    });

    // Filtrer les repos de code (tout sauf google_drive qui est utilisé uniquement pour sync)
    const codeRepos = repos.filter(r => r.type !== 'google_drive'); //DELETE

    // Créer les connecteurs via le registre (générique, supporte github, huggingface, etc.)
    const connectors = codeRepos
      .map(repo => ConnectorRegistry.createConnector({ repo, env: process.env }))
      .filter((c): c is ExternalConnector => c !== null);

    if (connectors.length === 0) {
      console.warn("   ⚠️ Aucun connecteur de code disponible, sync basé uniquement sur Google Drive");
    }

    // Initialiser l'orchestrateur pour gérer tous les connecteurs
    const orchestrator = new ConnectorsOrchestrator(connectors, codeRepos);
    await orchestrator.connectAll();

    // 3. Récupérer les données externes - Google Drive Sync
    await gdConnector.connect();
    const folderId = process.env.GOOGLE_FOLDER_ID || "";
    const itemsGD = await gdConnector.fetchItems({ 
      folderId,
      pageSize: 10, // Plus large pour être sûr d'avoir assez de fichiers
      orderBy: "modifiedTime desc"
    });

    // Filtrer les fichiers Sync (pas les dossiers, nom contient "Sync")
    const syncFiles = itemsGD.filter(item => 
      item.type !== 'folder' && 
      item.name.includes('Sync')
    );

    let syncPreview = "";

    if (syncFiles.length === 0) {
      console.warn("   ⚠️ Aucun fichier Sync trouvé dans Google Drive");
    } else {
      // Récupérer le contenu du dernier Sync
      const latestSync = syncFiles[0];
      const content = await gdConnector.fetchItemContent(latestSync.id);
      syncPreview = content.content;
      
      console.log(`   📄 Dernier Sync: ${latestSync.name} (${latestSync.metadata?.modifiedTime})`);
    }

    await gdConnector.disconnect();

    // Déterminer la période pour les commits basée sur les 2 derniers Syncs
    let commitOptions: any = { maxCommits: 20 };

    if (syncFiles.length >= 2) {
      // On a au moins 2 Syncs : utiliser la période entre les 2 derniers
      const latestSyncDate = syncFiles[0].metadata?.modifiedTime;
      const previousSyncDate = syncFiles[1].metadata?.modifiedTime;
      
      if (latestSyncDate && previousSyncDate) {
        commitOptions.since = previousSyncDate;
        commitOptions.until = latestSyncDate;
        console.log(`   📅 Période des commits: ${previousSyncDate} → ${latestSyncDate}`);
      }
    } else if (syncFiles.length === 1) {
      // Un seul Sync : prendre tous les commits depuis ce Sync
      const latestSyncDate = syncFiles[0].metadata?.modifiedTime;
      if (latestSyncDate) {
        commitOptions.since = latestSyncDate;
        console.log(`   📅 Commits depuis: ${latestSyncDate}`);
      }
    } else {
      console.log(`   📅 Aucune période définie, récupération des ${commitOptions.maxCommits} derniers commits`);
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

    // 4. Identifier les contributions
    const contributions = await this.evaluator.identify({
      syncPreview,
      commits,
      users: teamMembers.map((u: User) => ({
        uuid: u.uuid,
        full_name: u.full_name,
        github_username: u.github_username
      }))
    });

    console.log(`   ✅ ${contributions.length} contributions identifiées`);

    // 5. Évaluer chaque contribution
    const evaluations: Evaluation[] = [];
    for (const contribution of contributions) {
      // Router vers le bon connecteur basé sur l'item ID
      const connector = orchestrator.getConnectorForItem(contribution.commitSha);
      if (!connector) {
        console.warn(`   ⚠️ No connector found for item ${contribution.commitSha}, skipping evaluation`);
        continue;
      }

      const snapshot = await connector.fetchItemContent(contribution.commitSha);
      const grid = EvaluationGridRegistry.getGrid(contribution.type);

      const preparedSnapshot = await this.prepareSnapshot(snapshot);
      const evaluation = await this.evaluator.evaluate(contribution, { 
        snapshot: preparedSnapshot, 
        grid 
      });

      // Attacher la contribution à l'évaluation
      evaluation.contribution = contribution;
      evaluations.push(evaluation);
    }

    console.log(`   ✅ ${evaluations.length} évaluations effectuées`);

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
      console.warn("   ⚠️ Aucune évaluation trouvée");
      return [];
    }

    // 4. Calculer les rewards
    const totalPool = challenge.contribution_points_reward;
    const rewards = computeRewards(evaluations, totalPool);

    console.log(`   ✅ ${rewards.length} rewards calculés`);

    // 5. Mettre à jour les contributions avec les rewards
    for (const reward of rewards) {
      const contribution = contributions.find(c => 
        c.title === reward.contributionTitle
      );
      
      if (contribution) {
        await this.contributionRepo.update(contribution.uuid, {
          reward: reward.reward
        });
      }
    }

    console.log(`   ✅ Contributions mises à jour avec les rewards`);

    return rewards;
  }

  /**
   * Sauvegarde les évaluations en base de données
   */
  private async saveEvaluations(challengeId: string, evaluations: Evaluation[]): Promise<void> {
    for (const evaluation of evaluations) {
      if (!evaluation.contribution) continue;

      const contrib = evaluation.contribution;

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
    }

    console.log(`   💾 ${evaluations.length} contributions sauvegardées en DB`);
  }

  /**
   * Prépare un snapshot pour l'évaluation en créant le workspace temporaire
   */
  private async prepareSnapshot(snapshot: any): Promise<any> {
    const fs = await import("fs/promises");
    const path = await import("path");
    const os = await import("os");

    const baseDir = path.join(os.tmpdir(), "eval_agent", snapshot.commitSha);
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