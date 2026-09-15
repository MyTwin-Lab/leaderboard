function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/** La configuration d'un challenge existant, telle qu'enregistrée. */
export function flowConfigRecord(challenge: { flow_config?: unknown } | null | undefined): Record<string, unknown> {
  return asRecord(challenge?.flow_config);
}

/** La section d'une extension dans la configuration (`flow_config.extensions[key]`). */
export function extensionConfigRecord(challenge: { flow_config?: unknown } | null | undefined, key: string): Record<string, unknown> {
  return asRecord(asRecord(flowConfigRecord(challenge).extensions)[key]);
}
