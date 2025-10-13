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
import { GitHubExternalConnector } from "../connectors/implementation/Github.connector.js";

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

    // Pour l'instant, on prend le premier repo GitHub (à améliorer)
    const githubRepo = repos.find(r => r.type === 'github');
    if (!githubRepo) {
      throw new Error("Aucun repository GitHub trouvé pour ce challenge");
    }

    const gitConnector = new GitHubExternalConnector({
      token: process.env.GITHUB_TOKEN || "",
      owner: process.env.GITHUB_OWNER || "",
      repo: githubRepo.title,
    });

    // 3. Récupérer les données externes
    await gdConnector.connect();
    const folderId = process.env.GOOGLE_FOLDER_ID || "";
    const itemsGD = await gdConnector.fetchItems({ 
      folderId,
      pageSize: 10,
      orderBy: "modifiedTime desc"
    });

    let syncPreview = "";
    if (itemsGD.length > 0 && itemsGD[0].type !== 'folder') {
      const content = await gdConnector.fetchItemContent(itemsGD[0].id);
      syncPreview = content.content;
    }
    await gdConnector.disconnect();

    const itemsGit = await gitConnector.fetchItems({
      maxCommits: 10,
    });

    // 4. Identifier les contributions
    const contributions = await this.evaluator.identify({
      syncPreview,
      commits: itemsGit,
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
      const snapshot = await gitConnector.fetchItemContent(contribution.commitSha);
      const grid = this.evaluator.getGrid(contribution.type);

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