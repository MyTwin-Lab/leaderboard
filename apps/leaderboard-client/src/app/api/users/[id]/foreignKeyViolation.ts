/** Code Postgres d'une violation de clé étrangère. */
const POSTGRES_FOREIGN_KEY_VIOLATION = '23503';

/**
 * Reconnaît une violation de FK et en extrait la table qui bloque.
 *
 * drizzle-orm emballe l'erreur pg dans DrizzleQueryError : le code vit sur
 * `.cause`, pas sur le wrapper (même lecture que caseClaim.repo.ts).
 *
 * Pour un DELETE bloqué, le message pg se termine par `on table "<référençante>"`
 * — c'est la table qu'un admin doit aller nettoyer. `table` sert de repli.
 */
export function describeForeignKeyViolation(error: unknown): { table: string | null } | null {
  const candidate = error as { code?: unknown; cause?: { code?: unknown } } | null | undefined;
  const pgError = (candidate?.code === POSTGRES_FOREIGN_KEY_VIOLATION ? candidate : candidate?.cause) as
    | { code?: unknown; message?: unknown; table?: unknown }
    | undefined;
  if (pgError?.code !== POSTGRES_FOREIGN_KEY_VIOLATION) return null;

  const fromMessage = typeof pgError.message === 'string'
    ? /on table "([^"]+)"\s*$/.exec(pgError.message)?.[1]
    : undefined;
  const fromField = typeof pgError.table === 'string' ? pgError.table : undefined;
  return { table: fromMessage ?? fromField ?? null };
}
