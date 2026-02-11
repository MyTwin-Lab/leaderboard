import { 
  ChallengeRepository, 
  ChallengeTeamRepository,
  TaskRepository
} from "../../database-service/repositories/index.js";
import type { Challenge, Repo, User, Task } from "../../database-service/domain/entities.js";
import { GoogleDriveConnector } from "../../connectors/implementation/GD.connector.js";
import { ConnectorRegistry } from "../../connectors/registry.js";
import { ConnectorsOrchestrator } from "../../connectors/connectors.orchestrator.js";
import type { ExternalConnector, ExternalItem } from "../../connectors/interfaces.js";
import { config } from "../../config/index.js";

export interface ChallengeContext {
  challenge: Challenge;
  repos: Repo[];
  teamMembers: User[];
  tasks: Task[];
}

export interface SyncData {
  syncPreview: string;
  commits: CommitData[];
  windowStart?: Date;
  windowEnd?: Date;
}

export interface CommitData {
  id: string;
  message: string;
  author: string;
  date: string;
  sha: string;
  html_url: string;
}

export interface ConnectorsContext {
  orchestrator: ConnectorsOrchestrator;
  gdConnector: GoogleDriveConnector;
}

/**
 * ChallengeContextService
 * -----------------------
 * Gère la récupération du contexte d'un challenge et l'initialisation des connecteurs.
 */
export class ChallengeContextService {
  private challengeRepo: ChallengeRepository;
  private challengeTeamRepo: ChallengeTeamRepository;
  private taskRepo: TaskRepository;

  constructor() {
    this.challengeRepo = new ChallengeRepository();
    this.challengeTeamRepo = new ChallengeTeamRepository();
    this.taskRepo = new TaskRepository();
  }

  /**
   * Récupère le contexte complet d'un challenge (challenge, repos, team, tasks)
   */
  async getChallengeContext(challengeId: string): Promise<ChallengeContext> {
    const challenge = await this.challengeRepo.findById(challengeId);
    if (!challenge) {
      throw new Error(`[ChallengeContextService] Challenge ${challengeId} not found`);
    }

    const repos = await this.challengeRepo.findRepos(challengeId);
    const teamMembers = await this.challengeTeamRepo.findTeamMembers(challengeId);
    const tasks = await this.taskRepo.findByChallenge(challengeId);

    return { challenge, repos, teamMembers, tasks };
  }

  /**
   * Initialise les connecteurs pour un challenge
   */
  async initializeConnectors(repos: Repo[]): Promise<ConnectorsContext> {
    // Google Drive connector pour les fichiers Sync
    const gdConnector = new GoogleDriveConnector({
      clientId: config.google.clientId || "",
      clientSecret: config.google.clientSecret || "",
      refreshToken: config.google.refreshToken || "",
      redirectUri: config.google.redirectUri || "http://localhost:3000/oauth/callback",
    });

    // Filtrer les repos de code (tout sauf google_drive)
    const codeRepos = repos.filter(r => r.type !== 'google_drive');

    // Créer les connecteurs via le registre
    const connectors = codeRepos
      .map(repo => ConnectorRegistry.createConnector(repo))
      .filter((c): c is ExternalConnector => c !== null);

    if (connectors.length === 0) {
      console.warn("[ChallengeContextService] Aucun connecteur de code disponible");
    }

    // Initialiser l'orchestrateur
    const orchestrator = new ConnectorsOrchestrator(connectors, codeRepos);
    await orchestrator.connectAll();
    await gdConnector.connect();

    return { orchestrator, gdConnector };
  }

  /**
   * Récupère les données de synchronisation (fichiers Sync + commits)
   */
  async fetchSyncData(
    challenge: Challenge,
    connectorsCtx: ConnectorsContext
  ): Promise<SyncData> {
    const { orchestrator, gdConnector } = connectorsCtx;

    // Récupérer les fichiers Google Drive
    const folderId = config.google.folderId || "";
    const itemsGD = await gdConnector.fetchItems({ 
      folderId,
      pageSize: 10,
      orderBy: "modifiedTime desc"
    });

    // Filtrer les fichiers Sync
    const syncFiles = itemsGD.filter(item => 
      item.type !== 'folder' && 
      item.name.includes('Sync') &&
      item.name.includes(challenge.title)
    );

    let syncPreview = "";
    let windowStart: Date | undefined;
    let windowEnd: Date | undefined;

    if (syncFiles.length === 0) {
      console.warn("[ChallengeContextService] Aucun fichier Sync trouvé");
    } else {
      // Récupérer le contenu du dernier Sync
      const latestSync = syncFiles[0];
      const content = await gdConnector.fetchItemContent(latestSync.id);
      syncPreview = content.content;
      
      console.log(`[ChallengeContextService] Dernier Sync: ${latestSync.name}`);

      // Définir la fenêtre temporelle
      if (syncFiles.length >= 2) {
        const latestDate = syncFiles[0].metadata?.modifiedTime;
        const previousDate = syncFiles[1].metadata?.modifiedTime;
        if (latestDate) windowEnd = new Date(latestDate);
        if (previousDate) windowStart = new Date(previousDate);
      } else if (syncFiles[0].metadata?.modifiedTime) {
        windowStart = new Date(syncFiles[0].metadata.modifiedTime);
        windowEnd = new Date();
      }
    }

    windowStart = new Date('2024-11-24T00:00:00Z'); // TO DELETE
    windowEnd = new Date('2024-11-27T23:59:59Z');

    // Déterminer les options pour les commits
    let commitOptions: any = { maxCommits: 50 };
    if (windowStart) commitOptions.since = windowStart.toISOString();
    if (windowEnd) commitOptions.until = windowEnd.toISOString();

    // Récupérer les commits
    const codeItems = await orchestrator.fetchAllItems(commitOptions);
    const commits: CommitData[] = codeItems
      .filter(i => i.type === "commit")
      .map(i => ({
        id: i.id,
        message: i.metadata?.message || i.name,
        author: i.metadata?.authorLogin || i.metadata?.author || "",
        date: i.metadata?.date || "",
        sha: i.metadata?.sha || i.id,
        html_url: i.url || "",
      }));

    return { syncPreview, commits, windowStart, windowEnd };
  }

  /**
   * Déconnecte tous les connecteurs
   */
  async disconnectAll(connectorsCtx: ConnectorsContext): Promise<void> {
    await connectorsCtx.orchestrator.disconnectAll();
    await connectorsCtx.gdConnector.disconnect();
  }
}
