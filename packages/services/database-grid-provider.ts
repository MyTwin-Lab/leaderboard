import type { GridProvider, EvaluationGridTemplate, DetailedEvaluationGridTemplate, EvaluationCategory, SubCriterion } from "../evaluator/grids/index.js";
import { EvaluationGridsRepository } from "../database-service/repositories/index.js";
import type { EvaluationGridFull } from "../database-service/domain/entities.js";

/**
 * DatabaseGridProvider
 * --------------------
 * Fournit les grilles d'évaluation depuis la base de données.
 * Convertit le format DB vers le format attendu par l'Evaluator.
 */
export class DatabaseGridProvider implements GridProvider {
  private repo: EvaluationGridsRepository;

  constructor() {
    this.repo = new EvaluationGridsRepository();
  }

  /**
   * Récupère une grille publiée depuis la DB et la convertit au format Evaluator
   */
  async getGrid(type: string): Promise<EvaluationGridTemplate | DetailedEvaluationGridTemplate | null> {
    // Chercher par slug (type = slug dans notre modèle)
    const dbGrid = await this.repo.findFullPublishedBySlug(type);
    
    if (!dbGrid) {
      return null;
    }

    return this.convertToEvaluatorFormat(dbGrid);
  }

  /**
   * Convertit une grille DB vers le format DetailedEvaluationGridTemplate
   */
  private convertToEvaluatorFormat(dbGrid: EvaluationGridFull): DetailedEvaluationGridTemplate {
    const categories: EvaluationCategory[] = dbGrid.categories.map(cat => ({
      category: cat.name,
      weight: cat.weight,
      type: cat.type,
      subcriteria: cat.subcriteria.map(sub => this.convertSubcriterion(sub)),
    }));

    return {
      type: dbGrid.slug,
      categories,
      instructions: dbGrid.instructions || '',
    };
  }

  /**
   * Convertit un sous-critère DB vers le format SubCriterion
   */
  private convertSubcriterion(dbSub: EvaluationGridFull['categories'][0]['subcriteria'][0]): SubCriterion {
    return {
      criterion: dbSub.criterion,
      description: dbSub.description || '',
      metrics: dbSub.metrics,
      indicators: dbSub.indicators,
      scoringGuide: {
        excellent: dbSub.scoring_excellent || '8-9: Excellent',
        good: dbSub.scoring_good || '5-7: Good',
        average: dbSub.scoring_average || '2-4: Average',
        poor: dbSub.scoring_poor || '0-1: Poor',
      },
    };
  }
}
