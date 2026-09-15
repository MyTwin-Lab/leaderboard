import { UserQualificationRepository } from "../database-service/repositories/index.js";
import { PlatformRegistry, type QualificationDeclaration } from "../registry/platform.js";

/**
 * Capacité `qualifications`
 * -------------------------
 * « Ce compte détient-il cette qualification ? » — la question qu'un flow pose
 * avant de laisser juger. La clé exigée vient de la configuration du challenge
 * (`reviewer_qualification`…), jamais du code du core ni du flow.
 *
 * Fermée par défaut : une clé absente (configuration illisible, paramètre non
 * posé) ne qualifie personne.
 */

export interface QualificationReader {
  has(userId: string, key: string): Promise<boolean>;
}

let defaultReader: QualificationReader | null = null;

function reader(): QualificationReader {
  defaultReader ??= new UserQualificationRepository();
  return defaultReader;
}

export async function hasQualification(
  userId: string,
  key: string | null | undefined,
  qualifications: QualificationReader = reader(),
): Promise<boolean> {
  if (!key) return false;
  return qualifications.has(userId, key);
}

/** Les qualifications que la distribution installée déclare. */
export function declaredQualifications(): QualificationDeclaration[] {
  return PlatformRegistry.qualifications();
}

export function isDeclaredQualification(key: string | null | undefined): boolean {
  return !!PlatformRegistry.qualification(key);
}

/** Le libellé d'une qualification, ou sa clé quand la distribution ne la déclare plus. */
export function qualificationLabel(key: string): string {
  return PlatformRegistry.qualification(key)?.label ?? key;
}
