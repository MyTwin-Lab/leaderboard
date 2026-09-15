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

/**
 * GridProvider
 * ------------
 * Interface pour les fournisseurs de grilles (DB, fichiers, etc.)
 */
export interface GridProvider {
  getGrid(type: string): Promise<EvaluationGridTemplate | DetailedEvaluationGridTemplate | null>;
}

type Grid = EvaluationGridTemplate | DetailedEvaluationGridTemplate;

interface GridRegistryState {
  grids: Map<string, Grid>;
  dbProvider: GridProvider | null;
  warnedWithoutProvider: boolean;
}

/*
 * L'état vit sur `globalThis` : le provider de grilles en base est branché une
 * fois par la distribution au démarrage du serveur, et Next peut charger ce
 * module plusieurs fois.
 */
const STATE_KEY = '__leaderboardEvaluationGridRegistry';

function state(): GridRegistryState {
  const holder = globalThis as unknown as Record<string, GridRegistryState | undefined>;
  holder[STATE_KEY] ??= { grids: new Map(), dbProvider: null, warnedWithoutProvider: false };
  return holder[STATE_KEY]!;
}

/**
 * EvaluationGridRegistry
 * ----------------------
 * Registry centralisé pour gérer les grilles d'évaluation par type de contribution.
 * Supporte les grilles statiques (fichiers) et dynamiques (base de données).
 */
export class EvaluationGridRegistry {
  /**
   * Configure le fournisseur de grilles depuis la base de données.
   * Appelé une fois par la distribution installée.
   */
  static setDatabaseProvider(provider: GridProvider): void {
    state().dbProvider = provider;
  }

  /**
   * Enregistre une grille statique (fichier)
   */
  static register(grid: Grid): void {
    state().grids.set(grid.type, grid);
  }

  /**
   * Récupère une grille (sync) - uniquement les grilles statiques
   * @deprecated Utiliser getGridAsync pour supporter les grilles DB
   */
  static getGrid(type: string): Grid {
    const grid = state().grids.get(type);
    if (!grid) {
      throw new Error(`[EvaluationGridRegistry] No grid found for type: "${type}"`);
    }
    return grid;
  }

  /**
   * Récupère une grille (async) - DB en priorité, puis fallback sur statique
   */
  static async getGridAsync(type: string): Promise<Grid> {
    const current = state();

    // 1. Essayer la base de données en priorité
    if (current.dbProvider) {
      try {
        const dbGrid = await current.dbProvider.getGrid(type);
        if (dbGrid) {
          console.log(`[EvaluationGridRegistry] Using DB grid for type: ${type}`);
          return dbGrid;
        }
      } catch (error) {
        console.warn(`[EvaluationGridRegistry] DB provider error for type ${type}:`, error);
      }
    } else if (!current.warnedWithoutProvider) {
      // Sans provider, une grille publiée en base serait ignorée sans bruit.
      console.warn('[EvaluationGridRegistry] No database grid provider installed: only built-in grids are served');
      current.warnedWithoutProvider = true;
    }

    // 2. Fallback sur les grilles statiques
    const staticGrid = current.grids.get(type);
    if (staticGrid) {
      console.log(`[EvaluationGridRegistry] Using static grid for type: ${type}`);
      return staticGrid;
    }

    throw new Error(`[EvaluationGridRegistry] No grid found for type: "${type}"`);
  }

  static hasGrid(type: string): boolean {
    return state().grids.has(type);
  }

  static getAvailableTypes(): string[] {
    return Array.from(state().grids.keys());
  }
}

// Auto-register all grids
import { evaluationGrid as codeGrid } from './code.grid.js';
import { modelGrid } from './model.grid.js';
import { datasetGrid } from './dataset.grid.js';

EvaluationGridRegistry.register(codeGrid);
EvaluationGridRegistry.register(modelGrid);
EvaluationGridRegistry.register(datasetGrid);
