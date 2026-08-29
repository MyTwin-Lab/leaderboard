import { EvaluationGridTemplate } from './index.js';

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
