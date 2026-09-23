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
 * Ce qu'on sait du groupe quand le visiteur arrive par un lien d'invitation —
 * la réponse de `GET /api/challenges/[id]/group/[token]`.
 *
 * Ici plutôt que dans le composant qui l'affiche : c'est la forme d'une
 * réponse d'API, et l'écran qui la rend a déjà changé une fois.
 */
export interface GroupInvite {
  ownerName: string;
  size: number;
  maxSize: number;
  joinable: boolean;
  reason: string | null;
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
 * Le type d'un challenge **repère** : il n'ouvre aucun travail.
 *
 * « Community Management », « Design system », « Documentation » — des entrées
 * du catalogue qui disent qu'un sujet existe et à qui parler, sans board, sans
 * dépôt, sans branche et sans personne à inscrire. Rien ne les rejoint : c'est
 * ce qui les distingue d'un challenge code qui n'aurait pas encore de
 * participants.
 *
 * Une valeur dans `challenges.type`, pas un `null` : `null` est l'absence de
 * réponse d'une row écrite avant que le type existe, et le code la rabat sur
 * `code` un peu partout. `'none'` est une réponse.
 */
export const PLACEHOLDER_TYPE = 'none';

export function isPlaceholderChallenge(type: string | null | undefined): boolean {
  return type === PLACEHOLDER_TYPE;
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
  return BRIEF_GATED_TYPES.includes(challengeType ?? '');
}

/**
 * L'écran vitrine prend-il toute la page ?
 *
 * Deux chemins qui n'ont de commun que leur réponse :
 *
 * - Un challenge **repère** l'affiche toujours, et pour tout le monde. C'est sa
 *   seule page : il n'y a pas d'espace de travail derrière, donc rien ne
 *   justifierait de la conditionner à un brief ou à une appartenance. Sans
 *   brief elle se réduit au hero et à sa description, ce qui suffit à dire
 *   qu'un sujet existe.
 * - Un challenge `code` ou `ml` l'affiche à qui n'a pas rejoint et a un brief à
 *   lire, ou à un membre sur téléphone — là où l'espace de travail, qui veut un
 *   clavier et un IDE, n'a rien à montrer.
 */
export function showVitrineScreen({ isMember, isPhone, challengeType, brief }: {
  isMember: boolean;
  isPhone: boolean;
  challengeType: string | null | undefined;
  brief: string | null | undefined;
}): boolean {
  if (isPlaceholderChallenge(challengeType)) return true;
  if (!BRIEF_GATED_TYPES.includes(challengeType ?? '')) return false;
  return isMember ? isPhone : shouldShowBrief({ isMember, challengeType, brief });
}
