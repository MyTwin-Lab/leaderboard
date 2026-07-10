import { Octokit } from "octokit";
import { Buffer } from "buffer";
import {
  ExternalConnector,
  ConnectorAuthConfig,
  ExternalItem,
  ConnectorType,
} from "../interfaces.js";

/**
 * Options pour le connecteur GitHub externe
 */
export interface GitHubExternalConnectorOptions {
  /** Token d'authentification GitHub (PAT ou OAuth) */
  token: string;
  
  /** Owner du repository (ex: "facebook") */
  owner: string;
  
  /** Nom du repository (ex: "react") */
  repo: string;
  
  /** Branch à utiliser (par défaut: branche par défaut du repo) */
  branch?: string;
}

/**
 * Options pour fetchItems
 */
export interface FetchCommitsOptions {
  /** Date de début (ISO 8601) */
  since?: string;
  
  /** Date de fin (ISO 8601) */
  until?: string;
  
  /** Auteur des commits (GitHub username) */
  author?: string;
  
  /** Nombre maximum de commits à récupérer */
  maxCommits?: number;
}

/**
 * Connecteur GitHub qui implémente l'interface ExternalConnector
 * 
 * - fetchItems: retourne les commits d'un repo sur une période
 * - fetchItemContent: retourne la snapshot du repo à un commit donné
 */
export class GitHubExternalConnector implements ExternalConnector {
  readonly name = "GitHub External Connector";
  readonly type: ConnectorType = "github";
  readonly authConfig: ConnectorAuthConfig;

  private octokit: Octokit;
  private owner: string;
  private repo: string;
  private branch?: string;
  private defaultBranch?: string;

  constructor(options: GitHubExternalConnectorOptions) {
    this.authConfig = {
      token: options.token,
    };
    
    this.octokit = new Octokit({ auth: options.token });
    this.owner = options.owner;
    this.repo = options.repo;
    this.branch = options.branch;
  }

  /**
   * Initialise la connexion et récupère la branche par défaut
   */
  async connect(): Promise<void> {
    try {
      const { data } = await this.octokit.rest.repos.get({
        owner: this.owner,
        repo: this.repo,
      });
      
      this.defaultBranch = data.default_branch;
      
      // Si aucune branche n'est spécifiée, utiliser la branche par défaut
      if (!this.branch) {
        this.branch = this.defaultBranch;
      }
    } catch (error: any) {
      throw new Error(`Failed to connect to GitHub repo ${this.owner}/${this.repo}: ${error.message}`);
    }
  }

  /**
   * Vérifie que la connexion est valide
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.octokit.rest.repos.get({
        owner: this.owner,
        repo: this.repo,
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Récupère la liste des commits du repository sur une période
   * 
   * @param options - Options de filtrage (since, until, author, maxCommits)
   * @returns Liste des commits avec id, message, auteur, date
   */
  async fetchItems(options?: FetchCommitsOptions): Promise<ExternalItem[]> {
    const opts = options || {};
    const perPage = 100;
    const maxCommits = opts.maxCommits || 1000;
    let page = 1;
    const items: ExternalItem[] = [];

    try {
      while (items.length < maxCommits) {
        const response = await this.octokit.rest.repos.listCommits({
          owner: this.owner,
          repo: this.repo,
          sha: this.branch,
          author: opts.author,
          since: opts.since,
          until: opts.until,
          per_page: Math.min(perPage, maxCommits - items.length),
          page,
        });

        if (response.data.length === 0) break;

        for (const commit of response.data) {
          items.push({
            id: commit.sha,
            name: commit.commit.message.split('\n')[0], // Première ligne du message
            type: "commit",
            url: commit.html_url,
            metadata: {
              sha: commit.sha,
              author: commit.commit.author?.name || "Unknown",
              authorEmail: commit.commit.author?.email,
              authorLogin: commit.author?.login,
              committer: commit.commit.committer?.name,
              committerLogin: commit.committer?.login,
              date: commit.commit.author?.date,
              message: commit.commit.message,
              additions: commit.stats?.additions,
              deletions: commit.stats?.deletions,
              totalChanges: commit.stats?.total,
              parentsCount: commit.parents?.length || 0,
            },
          });
        }

        if (response.data.length < perPage || items.length >= maxCommits) break;
        page++;
      }

      return items;
    } catch (error: any) {
      throw new Error(`Failed to fetch commits: ${error.message}`);
    }
  }

  /**
   * Récupère la snapshot complète du repository à un commit donné
   * 
   * @param itemId - SHA du commit
   * @returns Arborescence complète du repo avec le contenu des fichiers
   */
  /*
  async fetchItemContent(itemId: string): Promise<any> {
    try {
      // 1. Récupérer les informations du commit
      const commitResponse = await this.octokit.rest.repos.getCommit({
        owner: this.owner,
        repo: this.repo,
        ref: itemId,
      });

      const commit = commitResponse.data;

      // 2. Récupérer l'arborescence complète à ce commit
      const treeSha = commit.commit.tree.sha;
      const treeResponse = await this.octokit.rest.git.getTree({
        owner: this.owner,
        repo: this.repo,
        tree_sha: treeSha,
        recursive: "1", // Récursif pour avoir tous les fichiers
      });

      // 3. Filtrer les blobs (fichiers) et construire la structure
      const files = treeResponse.data.tree
        .filter((item: any) => item.type === "blob")
        .map((item: any) => ({
          path: item.path!,
          sha: item.sha!,
          size: item.size,
          url: item.url,
        }));

      // 4. Construire la réponse avec les métadonnées du commit et l'arborescence
      return {
        commit: {
          sha: commit.sha,
          message: commit.commit.message,
          author: {
            name: commit.commit.author?.name,
            email: commit.commit.author?.email,
            date: commit.commit.author?.date,
            login: commit.author?.login,
          },
          committer: {
            name: commit.commit.committer?.name,
            email: commit.commit.committer?.email,
            date: commit.commit.committer?.date,
            login: commit.committer?.login,
          },
          stats: {
            additions: commit.stats?.additions || 0,
            deletions: commit.stats?.deletions || 0,
            total: commit.stats?.total || 0,
          },
          url: commit.html_url,
        },
        tree: {
          sha: treeSha,
          url: treeResponse.data.url,
          truncated: treeResponse.data.truncated,
          filesCount: files.length,
        },
        files,
        repository: {
          owner: this.owner,
          name: this.repo,
          fullName: `${this.owner}/${this.repo}`,
        },
      };
    } catch (error: any) {
      throw new Error(`Failed to fetch commit content for ${itemId}: ${error.message}`);
    }
  }*/

  /**
   * Récupère les informations d’un commit et le contenu des fichiers modifiés (texte uniquement).
   * @param commitSha SHA du commit à analyser
   * @param includePatch Inclure le diff des fichiers modifiés (f.patch)
   */
  async fetchItemContent(commitSha: string, includePatch = false) {
    try {
      // 1️⃣ Récupérer le commit et la liste des fichiers modifiés
      const commitResponse = await this.octokit.rest.repos.getCommit({
        owner: this.owner,
        repo: this.repo,
        ref: commitSha,
      });

      const commit = commitResponse.data;
      const changedFiles = commit.files || [];

      // 2️⃣ Filtrer les fichiers "ajoutés" ou "modifiés" et de type texte
      const modFiles = changedFiles.filter(f => {
        if (f.status === "removed") return false;

        // Extensions typiquement textuelles
        const textExtensions = [
          ".ts", ".tsx", ".js", ".jsx", ".py", ".java", ".c", ".cpp", ".h", ".hpp",
          ".go", ".rs", ".sh", ".json", ".yml", ".yaml", ".xml", ".toml",
          ".md", ".txt", ".csv", ".html", ".css", ".scss", ".env", ".ini"
        ];

        const isTextExt = textExtensions.some(ext => f.filename.endsWith(ext));
        return isTextExt;
      });

      console.log(
        `Commit ${commitSha} → ${modFiles.length} fichiers modifiés :`,
        modFiles.map(f => f.filename)
      );

      // 3️⃣ Télécharger le contenu des fichiers modifiés texte
      const filesWithContent = await Promise.all(
        modFiles.map(async (f) => {
          try {
            const blobResp = await this.octokit.rest.git.getBlob({
              owner: this.owner,
              repo: this.repo,
              file_sha: f.sha!,
            });

            const base64 = blobResp.data.content || "";
            const buffer = Buffer.from(base64, "base64");

            // Déterminer si c’est binaire
            const isBinary = buffer.includes(0);
            if (isBinary) {
              // ignorer les binaires (défaut)
              return null;
            }

            const content = buffer.toString("utf-8");

            const fileData: any = {
              path: f.filename,
              status: f.status,
              additions: f.additions,
              deletions: f.deletions,
              changes: f.changes,
              sha: f.sha,
              isBinary: false,
              contentEncoding: "utf-8",
              content,
            };

            // Ajouter le patch (diff) si demandé
            if (includePatch && f.patch) {
              fileData.patch = f.patch;
            }

            return fileData;
          } catch (err: any) {
            return { path: f.filename, error: true, errorMessage: err.message };
          }
        })
      );

      // Supprimer les null (fichiers binaires ignorés)
      const filteredFiles = filesWithContent.filter(Boolean);

      // 4️⃣ Construire l’objet final
      return {
        /*commit: {*/
          commitSha: commit.sha,
          /*message: commit.commit.message,
          author: {
            name: commit.commit.author?.name,
            email: commit.commit.author?.email,
            date: commit.commit.author?.date,
            login: commit.author?.login,
          },
          committer: {
            name: commit.commit.committer?.name,
            email: commit.commit.committer?.email,
            date: commit.commit.committer?.date,
            login: commit.committer?.login,
          },
          stats: commit.stats,
          url: commit.html_url,
        },*/
        modifiedFiles: filteredFiles,
        /*repository: {
          owner: this.owner,
          name: this.repo,
          fullName: `${this.owner}/${this.repo}`,
        },*/
      };

    } catch (error: any) {
      throw new Error(`Failed to fetch commit content for ${commitSha}: ${error.message}`);
    }
  }

  /**
   * Méthode utilitaire pour télécharger le contenu d'un fichier spécifique à un commit
   * (non requis par l'interface mais utile)
   */
  async fetchFileContentAtCommit(commitSha: string, filePath: string): Promise<string> {
    try {
      const response = await this.octokit.rest.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path: filePath,
        ref: commitSha,
      });

      if (!("type" in response.data) || response.data.type !== "file") {
        throw new Error(`${filePath} is not a file`);
      }

      if (!response.data.content) {
        throw new Error(`No content available for ${filePath}`);
      }

      const buffer = Buffer.from(response.data.content, "base64");
      return buffer.toString("utf-8");
    } catch (error: any) {
      throw new Error(`Failed to fetch file ${filePath} at commit ${commitSha}: ${error.message}`);
    }
  }

  /**
   * Nettoyage (optionnel, rien à faire pour GitHub)
   */
  async disconnect(): Promise<void> {
    // Rien à nettoyer pour l'API GitHub
  }

  /**
   * Fetches a chronological activity timeline for the repo:
   * commits, pull requests, PR reviews, and branches.
   * Returns up to 100 items per category, sorted newest first.
   */
  async fetchRepoActivity(): Promise<import('../interfaces.js').GitHubRepoActivity> {
    const [commitsResp, prsResp, branchesResp] = await Promise.all([
      this.octokit.rest.repos.listCommits({
        owner: this.owner,
        repo: this.repo,
        sha: this.branch,
        per_page: 100,
      }).catch(() => ({ data: [] as any[] })),

      this.octokit.rest.pulls.list({
        owner: this.owner,
        repo: this.repo,
        state: 'all',
        per_page: 100,
      }).catch(() => ({ data: [] as any[] })),

      this.octokit.rest.git.listMatchingRefs({
        owner: this.owner,
        repo: this.repo,
        ref: 'heads/',
      }).catch(() => ({ data: [] as any[] })),
    ]);

    const events: import('../interfaces.js').GitHubEvent[] = [];

    // ── Commits ────────────────────────────────────────────────────────────
    for (const c of commitsResp.data) {
      events.push({
        type: 'commit',
        id: c.sha,
        title: c.commit.message.split('\n')[0],
        author: c.author?.login ?? c.commit.author?.name ?? 'unknown',
        date: c.commit.author?.date ?? new Date(0).toISOString(),
        url: c.html_url,
        metadata: {
          sha: c.sha,
          additions: c.stats?.additions,
          deletions: c.stats?.deletions,
        },
      });
    }

    // ── Pull requests + reviews ────────────────────────────────────────────
    const reviewsPerPR = await Promise.all(
      prsResp.data.map((pr: any) =>
        this.octokit.rest.pulls.listReviews({
          owner: this.owner,
          repo: this.repo,
          pull_number: pr.number,
        }).catch(() => ({ data: [] as any[] }))
      )
    );

    for (const pr of prsResp.data) {
      const isMerged = !!pr.merged_at;
      const state: 'open' | 'closed' | 'merged' = isMerged ? 'merged' : pr.state as 'open' | 'closed';

      events.push({
        type: 'pull_request',
        id: `pr-${pr.number}`,
        title: pr.title,
        author: pr.user?.login ?? 'unknown',
        date: pr.created_at,
        url: pr.html_url,
        metadata: { prNumber: pr.number, state },
      });
    }

    for (let i = 0; i < prsResp.data.length; i++) {
      const pr = prsResp.data[i];
      for (const review of reviewsPerPR[i].data) {
        if (!review.submitted_at) continue;
        const rawState = review.state?.toLowerCase();
        const reviewState: 'approved' | 'changes_requested' | 'commented' =
          rawState === 'approved' ? 'approved'
          : rawState === 'changes_requested' ? 'changes_requested'
          : 'commented';

        events.push({
          type: 'pr_review',
          id: `review-${review.id}`,
          title: `Review on #${pr.number}: ${pr.title}`,
          author: review.user?.login ?? 'unknown',
          date: review.submitted_at,
          url: review.html_url ?? pr.html_url,
          metadata: { prNumber: pr.number, reviewState },
        });
      }
    }

    // ── Branches (tip commit date as proxy for creation) ───────────────────
    const branchTipDates = await Promise.all(
      branchesResp.data.map(async (ref: any) => {
        try {
          const { data: commit } = await this.octokit.rest.repos.getCommit({
            owner: this.owner,
            repo: this.repo,
            ref: ref.object.sha,
          });
          return commit.commit.author?.date ?? new Date(0).toISOString();
        } catch {
          return new Date(0).toISOString();
        }
      })
    );

    for (let i = 0; i < branchesResp.data.length; i++) {
      const ref = branchesResp.data[i];
      const branchName = ref.ref.replace('refs/heads/', '');
      events.push({
        type: 'branch_created',
        id: `branch-${branchName}`,
        title: branchName,
        author: 'unknown',
        date: branchTipDates[i],
        url: `https://github.com/${this.owner}/${this.repo}/tree/${branchName}`,
        metadata: { branchName },
      });
    }

    // ── Sort newest first ──────────────────────────────────────────────────
    events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return { type: 'github', events };
  }
}