import { CriterionScore } from '../types.js';

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
 * EvaluationGridRegistry
 * ----------------------
 * Registry centralisé pour gérer les grilles d'évaluation par type de contribution.
 */
export class EvaluationGridRegistry {
  private static grids = new Map<string, EvaluationGridTemplate>();

  static register(grid: EvaluationGridTemplate): void {
    this.grids.set(grid.type, grid);
  }

  static getGrid(type: string): EvaluationGridTemplate {
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
import { codeGrid } from './code.grid.js';
import { modelGrid } from './model.grid.js';
import { datasetGrid } from './dataset.grid.js';
import { docsGrid } from './docs.grid.js';

EvaluationGridRegistry.register(codeGrid);
EvaluationGridRegistry.register(modelGrid);
EvaluationGridRegistry.register(datasetGrid);
EvaluationGridRegistry.register(docsGrid);
