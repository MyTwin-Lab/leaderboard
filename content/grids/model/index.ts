import type { EvaluationGridTemplate } from '../../../packages/evaluator/grids/index.js';
import type { GridSeed } from '../../../packages/capabilities/grid-seeds.js';

export const modelGrid: EvaluationGridTemplate = {
  type: "model",
  criteriaTemplate: [
    {
      criterion: "performance",
      weight: 0.4
    },
    {
      criterion: "innovation",
      weight: 0.3
    },
    {
      criterion: "reproductibilité",
      weight: 0.3
    }
  ],
  instructions: `
    Évalue la contribution de modèle ML selon les critères fournis.
    Pour chaque critère, attribue un score entre 0 et 9.
    Fournis un commentaire justifiant chaque score.
  `.trim()
};

/** Seed de la grille `model` : insérée en base si aucune grille ne porte ce slug. */
export const modelGridSeed: GridSeed = {
  slug: 'model',
  name: 'Model',
  description: "Contribution de modèle ML : performance, innovation, reproductibilité.",
  grid: modelGrid,
};
