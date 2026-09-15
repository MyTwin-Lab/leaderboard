import { flowCatalog } from '@/distribution/mytwin.flows';

/**
 * Le brief d'un challenge est un document comme les autres — il vit dans
 * `challenge_documents` et reste consultable dans le tiroir Docs une fois le
 * challenge rejoint. Ce qui le désigne est son nom de fichier, par
 * convention : pas de colonne dédiée, pas de migration.
 *
 * La constante est partagée entre l'API (upsert du POST) et le client
 * (tiroir de création, gate de la page challenge) pour qu'aucun de ces
 * endroits ne porte la chaîne en dur.
 */
export const BRIEF_FILENAME = 'brief.md';

/** Squelette proposé à l'auteur — la maquette rend ces trois sections. */
export const BRIEF_TEMPLATE = `## Context

Why this challenge exists, and what problem it addresses.

## Objective

What has to be shipped:

- First objective
- Second objective

## Expected result

What a reviewer should receive at the end.

- First deliverable
- Second deliverable
`;

export function findBrief<T extends { filename: string }>(docs: T[]): T | null {
  return docs.find(d => d.filename === BRIEF_FILENAME) ?? null;
}

/**
 * L'accès à ce challenge passe-t-il par le brief ?
 *
 * C'est son flow qui le dit (`briefRequired`). Un flow dont aucune route ne
 * vérifie l'appartenance à l'équipe — la validation — en est exclu : le mettre
 * derrière le brief ne changerait pas seulement l'affichage, ça lui imposerait
 * une adhésion préalable qu'il n'a jamais demandée. Un type inconnu n'y passe
 * pas non plus.
 */
export function isBriefGated(challengeType: string | null | undefined): boolean {
  return flowCatalog.get(challengeType)?.briefRequired === true;
}

/**
 * Le brief remplace-t-il les KPI et l'espace de travail ?
 *
 * Le visiteur anonyme le lit comme le contributeur connecté : c'est la page
 * qui dit de quoi ce challenge parle, et la retenir jusqu'à la connexion
 * demande de s'engager avant de savoir sur quoi. Le `Join` de l'en-tête
 * l'emmène se connecter au moment où il décide, pas avant.
 *
 * Un membre ne le voit pas — il a déjà rejoint, son brief reste dans le
 * tiroir Docs.
 */
export function shouldShowBrief({ isMember, challengeType, brief }: {
  isMember: boolean;
  challengeType: string | null | undefined;
  brief: string | null | undefined;
}): boolean {
  if (isMember) return false;
  if (!brief || !brief.trim()) return false;
  return isBriefGated(challengeType);
}
