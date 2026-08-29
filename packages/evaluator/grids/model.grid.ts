import { EvaluationGridTemplate } from './index.js';

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
