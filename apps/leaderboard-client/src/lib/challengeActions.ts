/**
 * Les URL des actions d'un challenge (challenge 020, L4)
 * ------------------------------------------------------
 * Les actions d'un flow et de ses extensions passent par une seule route,
 * servie par le dispatcher du core. Le chemin est celui que l'action déclare,
 * query comprise (`targets?eligible=true`).
 */

export function flowActionUrl(challengeId: string, path: string): string {
  return `/api/challenges/${encodeURIComponent(challengeId)}/flow/${path}`;
}

export function extensionActionUrl(challengeId: string, extensionKey: string, path: string): string {
  return `/api/challenges/${encodeURIComponent(challengeId)}/ext/${encodeURIComponent(extensionKey)}/${path}`;
}
