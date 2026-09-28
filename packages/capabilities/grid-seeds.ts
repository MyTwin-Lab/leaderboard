import { EvaluationGridsRepository } from "../database-service/repositories/index.js";
import type { EvaluationGridCategory, EvaluationGridSubcriterion } from "../database-service/domain/entities.js";
import type { Grid } from "../evaluator/grids/index.js";

/**
 * Seeds de grilles
 * ----------------
 * Les grilles qu'un flow attend (`code`, `model`, `dataset` pour MyTwin) sont
 * du contenu : la distribution les liste, le déploiement les insère en base si
 * aucune grille ne porte leur slug. Une grille déjà là, publiée, en brouillon
 * ou archivée, n'est jamais touchée : ce qu'un admin en a fait prime.
 */

export interface GridSeed {
  slug: string;
  name: string;
  description?: string;
  grid: Grid;
}

export type GridCategoryRow = Omit<EvaluationGridCategory, "uuid" | "grid_id"> & {
  subcriteria: Array<Omit<EvaluationGridSubcriterion, "uuid" | "category_id">>;
};

/** Les catégories et sous-critères en base d'une grille de contenu. */
export function toCategoryRows(grid: Grid): GridCategoryRow[] {
  if ("categories" in grid) {
    return grid.categories.map((category, position) => ({
      name: category.category,
      weight: category.weight,
      type: category.type,
      position,
      subcriteria: category.subcriteria.map((sub, subPosition) => ({
        criterion: sub.criterion,
        description: sub.description,
        metrics: sub.metrics,
        indicators: sub.indicators,
        scoring_excellent: sub.scoringGuide.excellent,
        scoring_good: sub.scoringGuide.good,
        scoring_average: sub.scoringGuide.average,
        scoring_poor: sub.scoringGuide.poor,
        position: subPosition,
      })),
    }));
  }

  // Une grille simple devient une catégorie par critère : l'agent répartit le
  // poids d'une catégorie à parts égales entre ses sous-critères, et chaque
  // critère garde ainsi son propre poids.
  return grid.criteriaTemplate.map((criterion, position) => ({
    name: criterion.criterion,
    weight: criterion.weight,
    type: "mixed",
    position,
    subcriteria: [{ criterion: criterion.criterion, position: 0 }],
  }));
}

export type GridSeedRepository = Pick<
  EvaluationGridsRepository,
  "findBySlug" | "create" | "createCategory" | "createSubcriterion" | "publish"
>;

export interface GridSeedReport {
  slug: string;
  status: "present" | "inserted";
}

/** Insère et publie chaque grille absente. Idempotent : un second passage ne trouve que des grilles présentes. */
export async function seedGrids(
  seeds: readonly GridSeed[],
  repo: GridSeedRepository = new EvaluationGridsRepository(),
): Promise<GridSeedReport[]> {
  const report: GridSeedReport[] = [];

  for (const seed of seeds) {
    if (await repo.findBySlug(seed.slug)) {
      report.push({ slug: seed.slug, status: "present" });
      continue;
    }

    const grid = await repo.create({
      slug: seed.slug,
      name: seed.name,
      description: seed.description,
      version: 1,
      status: "draft",
      instructions: seed.grid.instructions,
    });

    for (const { subcriteria, ...category } of toCategoryRows(seed.grid)) {
      const created = await repo.createCategory({ ...category, grid_id: grid.uuid });
      for (const subcriterion of subcriteria) {
        await repo.createSubcriterion({ ...subcriterion, category_id: created.uuid });
      }
    }

    await repo.publish(grid.uuid);
    report.push({ slug: seed.slug, status: "inserted" });
  }

  return report;
}
