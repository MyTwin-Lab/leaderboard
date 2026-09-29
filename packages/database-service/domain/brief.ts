/**
 * Le brief d'un challenge est un document comme les autres — il vit dans
 * `challenge_documents`, et ce qui le désigne est son nom de fichier, par
 * convention : pas de colonne dédiée, pas de migration.
 *
 * La constante vit dans le domaine parce que deux couches l'écrivent : la route
 * des documents (upsert du POST, depuis le tiroir de challenge) et la promotion
 * d'un sandbox (`SandboxPromotionService`, dans sa transaction). Le client la
 * relit depuis `lib/challengeBrief.ts`.
 */
export const BRIEF_FILENAME = "brief.md";
