import { CriterionScore } from '../types.js';

/**
 * Sous-critère d'évaluation avec métriques et guide de scoring
 */
export interface SubCriterion {
  criterion: string;
  description: string;
  metrics?: string[];
  indicators?: string[];
  scoringGuide: {
    excellent: string;
    good: string;
    average: string;
    poor: string;
  };
}

/**
 * Catégorie de critères d'évaluation
 */
export interface EvaluationCategory {
  category: string;
  weight: number;
  type: 'objective' | 'mixed' | 'subjective' | 'contextual';
  subcriteria: SubCriterion[];
}

/**
 * EvaluationGridTemplate
 * ----------------------
 * Template de grille d'évaluation pour un type de contribution.
 * Utilise CriterionScore (sans le score) comme template de critères.
 */
export interface EvaluationGridTemplate {
  type: string;
  criteriaTemplate: Array<Omit<CriterionScore, 'score' | 'comment'>>;
  instructions: string;
}

/**
 * DetailedEvaluationGridTemplate
 * ----------------------
 * Template de grille d'évaluation avec catégories et sous-critères détaillés.
 */
export interface DetailedEvaluationGridTemplate {
  type: string;
  categories: EvaluationCategory[];
  instructions: string;
}

export type Grid = EvaluationGridTemplate | DetailedEvaluationGridTemplate;

/**
 * GridProvider
 * ------------
 * Interface pour les fournisseurs de grilles (DB, fichiers, etc.)
 */
export interface GridProvider {
  getGrid(slug: string): Promise<Grid | null>;
}

interface GridRegistryState {
  provider: GridProvider | null;
}

/*
 * L'état vit sur `globalThis` : le provider de grilles est branché une fois
 * par la distribution au démarrage du serveur, et Next peut charger ce module
 * plusieurs fois.
 */
const STATE_KEY = '__leaderboardEvaluationGridRegistry';

function state(): GridRegistryState {
  const holder = globalThis as unknown as Record<string, GridRegistryState | undefined>;
  holder[STATE_KEY] ??= { provider: null };
  return holder[STATE_KEY]!;
}

/**
 * EvaluationGridRegistry
 * ----------------------
 * Sert les grilles d'évaluation par slug, depuis le provider que la
 * distribution installe (la base, pour MyTwin).
 *
 * Aucune grille n'est intégrée au core : `code`, `model` et `dataset` sont des
 * seeds de contenu insérées en base au déploiement. Une grille absente lève
 * une erreur qui cite son slug, plutôt que de retomber sans bruit sur une
 * copie figée qui ignorerait les modifications faites depuis l'admin.
 */
export class EvaluationGridRegistry {
  /** Appelé une fois par la distribution installée. */
  static setDatabaseProvider(provider: GridProvider): void {
    state().provider = provider;
  }

  /** Retire le provider — réservé aux tests. */
  static reset(): void {
    state().provider = null;
  }

  static async getGrid(slug: string): Promise<Grid> {
    const { provider } = state();
    if (!provider) {
      throw new Error(`[EvaluationGridRegistry] No grid provider installed, cannot load grid "${slug}"`);
    }

    const grid = await provider.getGrid(slug);
    if (!grid) {
      throw new Error(`[EvaluationGridRegistry] No published grid "${slug}"`);
    }
    return grid;
  }
}
