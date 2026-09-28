import type { MlAwardRule } from "../../../content/flows/ml/reward.js";
import type { ChallengeRepoRole } from "../../database-service/domain/entities.js";

/**
 * Rôle d'un repo ML → règle de reward, contribution alimentée, grille.
 *
 * La table de référence du flux ML. Isolée dans son propre module — et non
 * laissée dans `ml-rewards.service.ts` — parce que la promotion d'un sandbox
 * (`services/sandbox/promotion.ts`) a besoin de la lire sans tirer avec elle
 * l'évaluateur OpenAI, les connecteurs et le registre de grilles.
 *
 * `model` est le seul rôle sans grille : sa moitié de reward est pilotée par la
 * métrique lue dans la model card Kaggle, pas par un agent. C'est aussi ce qui
 * explique qu'une promotion ne puisse pas le créditer — la proposition ne porte
 * pas de métrique.
 *
 * `title` et `isArtifact` décrivent la contribution écrite pour ce rôle. Ils
 * vivent ici et non dans `ml-workspace/route.ts` parce que deux chemins créent
 * désormais ces contributions — une soumission depuis le challenge, et la
 * reprise du travail à la promotion d'un sandbox. Une contribution reprise doit
 * être indistinguable d'une contribution soumise ; deux tables séparées auraient
 * divergé au premier renommage.
 *
 * `isArtifact` désigne l'URL qui identifie l'étape — c'est elle qui sert à
 * détecter la réutilisation, donc le code du modèle n'en est pas une.
 */
export const ML_ROLE_RULE: Record<ChallengeRepoRole, {
  rule: MlAwardRule;
  contributionType: string;
  /** Slug de grille, ou null quand la règle ne passe pas par l'agent. */
  grid: string | null;
  title: string;
  isArtifact: boolean;
}> = {
  dataset:    { rule: 'dataset',       contributionType: 'dataset',       grid: 'dataset', title: 'Dataset Submission',       isArtifact: true  },
  // Le modèle Kaggle n'est pas noté par un agent : sa moitié de reward est
  // pilotée par la métrique lue dans la model card.
  model:      { rule: 'model_metric',  contributionType: 'model',         grid: null,      title: 'Model Submission',         isArtifact: true  },
  model_code: { rule: 'model_code',    contributionType: 'model',         grid: 'code',    title: 'Model Submission',         isArtifact: false },
  api:        { rule: 'api_packaging', contributionType: 'api_packaging', grid: 'code',    title: 'API Packaging Submission', isArtifact: true  },
};
