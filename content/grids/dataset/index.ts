import type { EvaluationGridTemplate } from '../../../packages/evaluator/grids/index.js';
import type { GridSeed } from '../../../packages/capabilities/grid-seeds.js';

export const datasetGrid: EvaluationGridTemplate = {
  type: "dataset",
  criteriaTemplate: [
    {
      criterion: "qualité",
      weight: 0.4
    },
    {
      criterion: "utilité",
      weight: 0.3
    },
    {
      criterion: "documentation",
      weight: 0.3
    }
  ],
  instructions: `
    Évalue la contribution de dataset selon les critères fournis.
    Pour chaque critère, attribue un score entre 0 et 9.
    Fournis un commentaire justifiant chaque score.
  `.trim()
};

/** Seed de la grille `dataset` : insérée en base si aucune grille ne porte ce slug. */
export const datasetGridSeed: GridSeed = {
  slug: 'dataset',
  name: 'Dataset',
  description: 'Contribution de dataset : qualité, utilité, documentation.',
  grid: datasetGrid,
};
