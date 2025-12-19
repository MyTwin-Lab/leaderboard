import { EvaluationGridTemplate, DetailedEvaluationGridTemplate } from './grids/index.js';

/**
 * Une contribution identifiée par l’agent à évaluer.
 */
export interface Contribution {
    title: string;
    type: string;
    description?: string;
    challenge_id: string;
    tags?: string[];
    userId: string;
    commitShas: string[];
}

/**
 * Une contribution identifiée par l’agent à évaluer.
 */
export interface ToMergeContribution {
    contribution: Contribution,
    oldContributionId: string;
}

/**
 * Un score individuel sur un critère d’évaluation.
 */
export interface CriterionScore {
    criterion: string;
    score: number;      // 0–100
    weight: number;
    comment?: string;
}

/**
 * Résultat global de l’évaluation d’une contribution.
 */
export interface Evaluation {
    scores: CriterionScore[];
    globalScore: number;
    // Métadonnées de la contribution évaluée
    contribution?: Contribution;
}

/**
 * Résultat de la distribution des rewards pour une contribution
 */
export interface ContributionReward {
    userId: string;
    contributionTitle: string;
    score: number;
    reward: number; // Contribution Points (CP) attribués
}

/**
 * Contexte pour l'identification des contributions
 */
export interface IdentifyContext {
  syncPreview?: string;  // Résumé de réunion depuis Google Drive
  commits: CommitInfo[]; // Liste des commits
  users: UserInfo[];     // Membres de l'équipe
  roadmap?: string;      // Roadmap du challenge
  tasks?: TaskInfo[];    // Tâches du challenge
}

/**
 * Informations sur une tâche (pour identification)
 */
export interface TaskInfo {
  uuid: string;
  title: string;
  description?: string;
  type: "solo" | "concurrent";
  status: "todo" | "done";
}

/**
 * Informations sur un commit (provenant des connecteurs)
 */
export interface CommitInfo {
  id: string;
  message: string;
  author: string;
  date: string;
  sha: string;
}

/**
 * Informations sur un utilisateur (pour identification)
 */
export interface UserInfo {
  uuid: string;
  full_name: string;
  github_username?: string;
}

/**
 * Contribution existante (pour fusion)
 */
export interface OldContribution {
  uuid: string;
  title: string;
  type: string;
  description?: string;
  tags?: string[];
  user_id: string;
  // Autres champs possibles : created_at, etc., mais sanitizés dans ChallengeService
}

/**
 * Contexte pour l'évaluation
 */
export interface EvaluateContext {
  snapshot: SnapshotInfo;
  grid: EvaluationGridTemplate | DetailedEvaluationGridTemplate; // Depuis grids/index.ts
}

/**
 * Informations sur un snapshot de code (pour évaluation)
 */
export interface SnapshotInfo {
  snapshotId?: string;
  commitSha?: string;
  commitShas?: string[];
  modifiedFiles: ModifiedFile[];
  workspacePath?: string; // Ajouté par prepareSnapshot
}

/**
 * Fichier modifié dans un commit
 */
export interface ModifiedFile {
  path: string;
  status?: string; // 'added', 'modified', etc.
  additions?: number;
  deletions?: number;
  content?: string; // Contenu du fichier
  lastSeenIn?: string; // SHA du commit où il a été vu
}