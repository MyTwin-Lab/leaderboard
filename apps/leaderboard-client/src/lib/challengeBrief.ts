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
 * Types de challenge dont l'accès passe par le brief.
 *
 * Les challenges de validation en sont exclus : aucune de leurs routes ne
 * vérifie l'appartenance à l'équipe, et rien n'y ajoute un validateur
 * implicitement. Les mettre derrière le brief ne changerait pas seulement
 * l'affichage, ça leur imposerait une adhésion préalable qu'ils n'ont jamais
 * demandée.
 */
export const BRIEF_GATED_TYPES = ['code', 'ml'];

/**
 * Le brief remplace-t-il les KPI et l'espace de travail ?
 *
 * Un visiteur anonyme ne le voit pas : il garde l'invitation à se connecter,
 * qui est la seule action qu'il puisse faire. Un membre non plus — il a déjà
 * rejoint, son brief reste dans le tiroir Docs.
 */
export function shouldShowBrief({ isAnonymous, isMember, challengeType, brief }: {
  isAnonymous: boolean;
  isMember: boolean;
  challengeType: string | null | undefined;
  brief: string | null | undefined;
}): boolean {
  if (isAnonymous || isMember) return false;
  if (!brief || !brief.trim()) return false;
  return BRIEF_GATED_TYPES.includes(challengeType ?? '');
}
