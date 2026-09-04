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
