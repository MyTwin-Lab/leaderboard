import { activityPayloads } from "../../../packages/connectors/activity.js";

/**
 * Activité d'un artefact Kaggle
 * -----------------------------
 * La forme du `payload` que rend `KaggleConnector.fetchRepoActivity` : les
 * métadonnées d'un dataset, ou les versions d'un modèle avec leurs métriques.
 * Pur : le flow ML et le client la lisent par ces extracteurs.
 */

export const KAGGLE_CONNECTOR_KEY = "kaggle";

export interface KaggleModelMetrics {
  auc?: number;
  f1?: number;
  accuracy?: number;
  [key: string]: number | undefined;
}

export interface KaggleModelVersion {
  versionNumber: number;
  createdAt: string; // ISO 8601
  metrics: KaggleModelMetrics;
}

export interface KaggleDatasetMeta {
  title: string;
  description?: string;
  tags?: string[];
  url: string;
  lastUpdated?: string;
}

export interface KaggleModelVersions {
  ref: string; // "owner/slug"
  versions: KaggleModelVersion[];
}

export interface KaggleActivityPayload {
  kind: "dataset" | "model";
  datasetMeta?: KaggleDatasetMeta;
  modelVersions?: KaggleModelVersions[];
}

/**
 * Un dépôt de modèle sans référence partagée porte un artefact par
 * contributeur : leurs activités se fusionnent en une seule.
 */
export function mergeKaggleActivities(payloads: unknown[]): KaggleActivityPayload {
  const merged: KaggleActivityPayload = { kind: "model", modelVersions: [] };
  for (const payload of payloads as Array<KaggleActivityPayload | null | undefined>) {
    if (!payload) continue;
    merged.kind = payload.kind;
    if (payload.datasetMeta) merged.datasetMeta = payload.datasetMeta;
    if (payload.modelVersions) merged.modelVersions = [...(merged.modelVersions ?? []), ...payload.modelVersions];
  }
  return merged;
}

function firstOfKind(activities: Record<string, unknown> | null | undefined, kind: KaggleActivityPayload["kind"]) {
  return (activityPayloads(activities, KAGGLE_CONNECTOR_KEY) as Array<KaggleActivityPayload | null>).find(
    (payload) => payload?.kind === kind,
  ) ?? null;
}

/** Le premier dataset Kaggle d'un challenge. */
export function kaggleDatasetOf(activities: Record<string, unknown> | null | undefined): KaggleActivityPayload | null {
  return firstOfKind(activities, "dataset");
}

/** Le premier modèle Kaggle d'un challenge, avec ses versions. */
export function kaggleModelOf(activities: Record<string, unknown> | null | undefined): KaggleActivityPayload | null {
  return firstOfKind(activities, "model");
}
