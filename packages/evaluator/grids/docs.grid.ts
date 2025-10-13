import { EvaluationGridTemplate } from './index.js';

export const docsGrid: EvaluationGridTemplate = {
  type: "docs",
  criteriaTemplate: [
    {
      criterion: "clarté",
      weight: 0.4
    },
    {
      criterion: "complétude",
      weight: 0.3
    },
    {
      criterion: "utilité",
      weight: 0.3
    }
  ],
  instructions: `
    Évalue la contribution de documentation selon les critères fournis.
    Pour chaque critère, attribue un score entre 0 et 100.
    Fournis un commentaire justifiant chaque score.
  `.trim()
};
