import type { MlRewardRules } from "../database-service/domain/mlRewardRules.js";
import type { RewardEntryMeta, RewardRuleKey } from "../database-service/domain/entities.js";

/**
 * Reward des challenges ML.
 *
 * Contrairement aux challenges code (pool distribué proportionnellement au
 * close, cf. reward.ts), les points ML sont absolus et attribués en live :
 * chaque soumission produit des lignes de ledger immuables, calculées sur
 * l'état du monde à cet instant. Rien n'est jamais recalculé.
 *
 * Fonction pure : aucune dépendance à la base, tout est passé en entrée.
 */

/** Règles qui produisent des points. `beat_best` est dérivé de `model_metric`. */
export type MlAwardRule = 'dataset' | 'model_metric' | 'model_code' | 'api_packaging';

/** Une ligne de ledger à écrire, sans les champs générés par la base. */
export interface RewardEntryDraft {
  challenge_id: string;
  user_id: string;
  contribution_id?: string;
  rule_key: RewardRuleKey;
  points: number;
  source_user_id?: string;
  meta?: RewardEntryMeta;
}

/** Auteurs des artefacts réutilisés par le contributeur courant. */
export interface MlLineage {
  datasetAuthorId?: string;
  datasetContributionId?: string;
  modelAuthorId?: string;
  modelContributionId?: string;
  /**
   * Datasets multiples attachés à la construction du modèle (sélection
   * communauté), chacun pesant `weight` (somme des poids = 1 sur l'ensemble
   * des datasets utilisés, y compris le sien qui ne produit pas d'entrée ici).
   * Quand présent, prend le pas sur `datasetAuthorId` dans le calcul du
   * prélèvement modèle — voir `computeReuseSplits`.
   */
  datasetUsages?: Array<{ authorId: string; contributionId: string; weight: number }>;
}

export interface MlAwardInput {
  rule: MlAwardRule;
  rules: MlRewardRules;
  challengeId: string;
  userId: string;
  contributionId: string;
  /** Note de l'agent, 0..1 — pour dataset, model_code, api_packaging. */
  agentScore?: number;
  /** Valeur de la métrique Kaggle, 0..1 — pour model_metric. */
  metricValue?: number;
  /** Meilleure métrique atteinte par les *autres* contributeurs, null s'il n'y en a pas. */
  bestOtherMetricValue?: number | null;
  /** Meilleure métrique déjà atteinte par ce contributeur, null s'il soumet pour la première fois. */
  myBestMetricValue?: number | null;
  /** CP encore disponibles sur le challenge. Les points sont clampés dessus. */
  remainingPool: number;
  lineage?: MlLineage;
}

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

/**
 * Normalise une métrique par rapport à sa baseline.
 * Une baseline à 0.5 sur l'AUC fait qu'un modèle au niveau du hasard vaut 0,
 * au lieu de rapporter la moitié du cap gratuitement.
 */
export function normalizeMetric(value: number, baseline: number): number {
  if (baseline >= 1) return 0;
  return clamp01((value - baseline) / (1 - baseline));
}

/** Les règles portées par l'étape modèle, sur lesquelles s'appliquent les prélèvements. */
const MODEL_RULE_KEYS: ReadonlySet<RewardRuleKey> = new Set<RewardRuleKey>([
  'model_metric',
  'model_code',
  'beat_best',
]);

interface GrossAward {
  rule_key: RewardRuleKey;
  points: number;
  meta: RewardEntryMeta;
}

/**
 * Le bonus récompense la prise de tête sur les *autres*, jamais le fait de se
 * dépasser soi-même.
 *
 * Sans la condition `alreadyLeading`, un contributeur déjà en tête toucherait le
 * bonus à chaque amélioration de son propre score — et comme rien n'est jamais
 * repris, il lui suffirait de soumettre 0.1, 0.2, 0.3… pour le farmer.
 *
 * Il peut en revanche se déclencher plusieurs fois si la tête change de mains :
 * reprendre son avance à quelqu'un qui vous l'avait prise est bien un exploit.
 */
function takesTheLead(input: MlAwardInput, value: number, normalized: number): boolean {
  // Un modèle sous la baseline ne bat personne, même s'il est le premier.
  if (normalized <= 0) return false;

  const bestOther = input.bestOtherMetricValue ?? null;
  const myBest = input.myBestMetricValue ?? null;

  const beatsOthers = bestOther === null || value > bestOther;
  const alreadyLeading = myBest !== null && (bestOther === null || myBest > bestOther);

  return beatsOthers && !alreadyLeading;
}

/**
 * Calcule les points bruts d'une règle, avant clamp et prélèvements.
 * Renvoie plusieurs awards quand une soumission en déclenche plusieurs
 * (une métrique qui bat le record produit model_metric + beat_best).
 */
function computeGrossAwards(input: MlAwardInput): GrossAward[] {
  const { rule, rules } = input;

  switch (rule) {
    case 'dataset': {
      const score = clamp01(input.agentScore ?? 0);
      return [{
        rule_key: 'dataset',
        points: Math.round(rules.dataset.cap * score),
        meta: { agentScore: score },
      }];
    }

    case 'model_metric': {
      const value = input.metricValue ?? 0;
      const normalized = normalizeMetric(value, rules.model.metric.baseline);
      const awards: GrossAward[] = [{
        rule_key: 'model_metric',
        points: Math.round(rules.model.cap * rules.model.kaggleShare * normalized),
        meta: { metricValue: value, normalizedMetric: normalized },
      }];

      if (rules.model.beatBestBonus > 0 && takesTheLead(input, value, normalized)) {
        awards.push({
          rule_key: 'beat_best',
          points: rules.model.beatBestBonus,
          meta: { metricValue: value, previousBest: input.bestOtherMetricValue ?? null },
        });
      }
      return awards;
    }

    case 'model_code': {
      const score = clamp01(input.agentScore ?? 0);
      return [{
        rule_key: 'model_code',
        points: Math.round(rules.model.cap * (1 - rules.model.kaggleShare) * score),
        meta: { agentScore: score },
      }];
    }

    case 'api_packaging': {
      const score = clamp01(input.agentScore ?? 0);
      return [{
        rule_key: 'api_packaging',
        points: Math.round(rules.apiPackaging.cap * score),
        meta: { agentScore: score },
      }];
    }
  }
}

/**
 * Produit les paires prélèvement/crédit pour un award sur l'étape modèle.
 *
 * Le prélèvement n'invente pas de points : il en redistribue. B gagne 500 et
 * en reverse 40 à Alice → trois lignes dont la somme vaut toujours 500, ce qui
 * garde le calcul du reliquat juste sans traitement particulier.
 *
 * Le crédit pointe sur la contribution de *l'auteur*, pas sur celle du
 * réutilisateur : c'est son dataset qui a généré ces points, et ça garantit que
 * le user_id d'une ligne est toujours le propriétaire de la contribution visée.
 */
function computeReuseSplits(
  award: GrossAward,
  input: MlAwardInput
): RewardEntryDraft[] {
  const { rules, lineage, userId, challengeId } = input;
  if (!lineage || !MODEL_RULE_KEYS.has(award.rule_key) || award.points <= 0) return [];

  const candidates: Array<{
    key: Extract<RewardRuleKey, 'reuse_dataset' | 'reuse_model'>;
    authorId?: string;
    contributionId?: string;
    share: number;
  }> = [];

  // Plusieurs datasets utilisés (sélection communauté) : chacun prélève sa part
  // au prorata de son poids. Le sien (pas d'entrée dans datasetUsages) reste
  // intégralement gardé. Sans sélection multiple, on retombe sur l'unique
  // candidat d'aujourd'hui — reuse à 100% du poids, comportement inchangé.
  if (lineage.datasetUsages && lineage.datasetUsages.length > 0) {
    for (const usage of lineage.datasetUsages) {
      candidates.push({
        key: 'reuse_dataset',
        authorId: usage.authorId,
        contributionId: usage.contributionId,
        share: usage.weight * rules.reuse.datasetShare,
      });
    }
  } else if (lineage.datasetAuthorId) {
    candidates.push({
      key: 'reuse_dataset',
      authorId: lineage.datasetAuthorId,
      contributionId: lineage.datasetContributionId,
      share: rules.reuse.datasetShare,
    });
  }

  candidates.push({
    key: 'reuse_model',
    authorId: lineage.modelAuthorId,
    contributionId: lineage.modelContributionId,
    share: rules.reuse.modelShare,
  });

  // Réutiliser son propre artefact ne prélève rien : on ne se paie pas soi-même.
  const active = candidates.filter(
    (c) => c.authorId && c.authorId !== userId && c.share > 0
  );
  if (active.length === 0) return [];

  let deductions = active.map((c) => ({
    ...c,
    amount: Math.round(award.points * c.share),
  }));

  // Plancher de garde : les prélèvements cumulés ne peuvent pas descendre le
  // réutilisateur sous minKeepShare de ses points bruts. Inatteignable avec
  // deux règles à 20%, mais l'éditeur de règles laisse passer 60% + 60%.
  const maxDeductible = award.points - Math.round(award.points * rules.reuse.minKeepShare);
  const totalDeduction = deductions.reduce((sum, d) => sum + d.amount, 0);
  if (totalDeduction > maxDeductible) {
    const ratio = totalDeduction === 0 ? 0 : maxDeductible / totalDeduction;
    deductions = deductions.map((d) => ({ ...d, amount: Math.floor(d.amount * ratio) }));
  }

  const drafts: RewardEntryDraft[] = [];
  for (const d of deductions) {
    if (d.amount <= 0) continue;
    // Prélèvement chez le réutilisateur, rattaché à SA contribution.
    drafts.push({
      challenge_id: challengeId,
      user_id: userId,
      contribution_id: input.contributionId,
      rule_key: d.key,
      points: -d.amount,
      source_user_id: d.authorId,
      meta: { rawPoints: award.points, sourceRule: award.rule_key },
    });
    // Crédit chez l'auteur, rattaché à SA contribution.
    drafts.push({
      challenge_id: challengeId,
      user_id: d.authorId!,
      contribution_id: d.contributionId,
      rule_key: d.key,
      points: d.amount,
      source_user_id: userId,
      meta: { rawPoints: award.points, sourceRule: award.rule_key },
    });
  }
  return drafts;
}

/**
 * Calcule toutes les lignes de ledger produites par une soumission.
 *
 * Ordre : points bruts → clamp sur le reliquat du pool → prélèvements de
 * réutilisation → plancher de garde. Le clamp vient avant les prélèvements
 * parce que c'est le montant réellement attribué qui se partage.
 */
export function computeMlAward(input: MlAwardInput): RewardEntryDraft[] {
  if (input.remainingPool <= 0) return [];

  const drafts: RewardEntryDraft[] = [];
  let remaining = input.remainingPool;

  for (const award of computeGrossAwards(input)) {
    if (award.points <= 0) continue;
    if (remaining <= 0) break;

    const granted = Math.min(award.points, remaining);
    const clamped: GrossAward = {
      ...award,
      points: granted,
      meta: granted < award.points
        ? { ...award.meta, rawPoints: award.points, clampedTo: granted }
        : award.meta,
    };
    remaining -= granted;

    drafts.push({
      challenge_id: input.challengeId,
      user_id: input.userId,
      contribution_id: input.contributionId,
      rule_key: clamped.rule_key,
      points: clamped.points,
      meta: clamped.meta,
    });

    drafts.push(...computeReuseSplits(clamped, input));
  }

  return drafts;
}

/**
 * Simule le maximum distribuable par un jeu de règles.
 *
 * Sert l'éditeur du manager : avec un pool fini et une attribution live, un
 * paramétrage trop généreux se découvre sinon en cours de challenge, une fois
 * le budget vidé par les premiers arrivés.
 *
 * Les prélèvements de réutilisation sont neutres (ils redistribuent sans
 * créer), donc ils ne comptent pas dans ce total.
 */
export function simulateMaxDistribution(
  rules: MlRewardRules,
  contributorCount: number
): number {
  const perContributor =
    rules.dataset.cap +
    rules.model.cap +
    rules.apiPackaging.cap;
  // Le bonus "meilleur modèle" ne peut tomber qu'une fois par record battu :
  // au pire chaque contributeur bat le précédent, d'où une fois par personne.
  const bonuses = rules.model.beatBestBonus * contributorCount;
  return perContributor * contributorCount + bonuses;
}
