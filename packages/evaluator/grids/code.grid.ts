import { EvaluationGridTemplate } from './index.js';

export const codeGrid: EvaluationGridTemplate = {
  type: "code",
  criteriaTemplate: [
    {
      criterion: "qualité",
      weight: 0.2
    },
    {
      criterion: "impact",
      weight: 0.3
    },
    {
      criterion: "complexité",
      weight: 0.3
    },
    {
      criterion: "architecture",
      weight: 0.2
    }
  ],
  instructions: `
    Évalue la contribution de code selon les critères fournis.
    Pour chaque critère, attribue un score entre 0 et 100.
    Fournis un commentaire justifiant chaque score.
  `.trim()
};
