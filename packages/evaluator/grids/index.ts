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
 * EvaluationGridRegistry
 * ----------------------
 * Registry centralisé pour gérer les grilles d'évaluation par type de contribution.
 */
export class EvaluationGridRegistry {
  private static grids = new Map<string, EvaluationGridTemplate | DetailedEvaluationGridTemplate>();

  static register(grid: EvaluationGridTemplate | DetailedEvaluationGridTemplate): void {
    this.grids.set(grid.type, grid);
  }

  static getGrid(type: string): EvaluationGridTemplate | DetailedEvaluationGridTemplate {
    const grid = this.grids.get(type);
    if (!grid) {
      throw new Error(`[EvaluationGridRegistry] No grid found for type: "${type}"`);
    }
    return grid;
  }

  static hasGrid(type: string): boolean {
    return this.grids.has(type);
  }

  static getAvailableTypes(): string[] {
    return Array.from(this.grids.keys());
  }
}

// Auto-register all grids
import { evaluationGrid as codeGrid } from './code.grid.js';
import { modelGrid } from './model.grid.js';
import { datasetGrid } from './dataset.grid.js';

EvaluationGridRegistry.register(codeGrid);
EvaluationGridRegistry.register(modelGrid);
EvaluationGridRegistry.register(datasetGrid);
