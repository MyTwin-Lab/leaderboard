import type { ConnectorActivity } from "./interfaces.js";

/**
 * Lecture générique des activités de dépôt
 * ----------------------------------------
 * Le core ne connaît que l'enveloppe `{ connectorKey, payload }`. Ces
 * fonctions pures servent au serveur comme au client : elles trient les
 * activités par connecteur, sans jamais lire un `payload`.
 */

export function isConnectorActivity(value: unknown): value is ConnectorActivity {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as { connectorKey?: unknown }).connectorKey === "string" &&
    "payload" in value
  );
}

/** Les `payload` des activités de ce connecteur, dans l'ordre des dépôts. */
export function activityPayloads(
  activities: Record<string, unknown> | null | undefined,
  connectorKey: string,
): unknown[] {
  return Object.values(activities ?? {})
    .filter(isConnectorActivity)
    .filter((activity) => activity.connectorKey === connectorKey)
    .map((activity) => activity.payload);
}
