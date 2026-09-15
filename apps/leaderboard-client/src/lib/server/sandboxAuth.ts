import type { SandboxViewer } from "@/lib/public/sandbox";
import type { StarIdentity } from "../../../../../packages/services/sandbox/sandbox.service";

/**
 * Qui a le droit de quoi sur un sandbox — pur, sans I/O.
 * ------------------------------------------------------
 * Les routes lisent la session (`verifyRequestToken`) et le cookie anonyme
 * (`readAnonId`), puis passent ici : la décision reste testable sans requête ni
 * base, et une règle n'est écrite qu'une fois.
 *
 * **Un manager n'a aucun droit particulier sur un sandbox** (§1.6 du plan). Un
 * manager est rattaché à un projet (`projects.manager_id`) ; un sandbox n'a pas
 * de projet. Sur un sandbox, un manager est un contributeur ordinaire — d'où
 * l'absence totale de `managerAuth` dans ce fichier, qui n'est pas un oubli.
 */

/**
 * Qui peut déposer une proposition. `viewer` en est exclu : c'est le rôle sans
 * aucun droit d'écriture (`docs/auth.md`). Il peut en revanche starer avec son
 * compte — lire et soutenir n'est pas écrire.
 */
export const SANDBOX_CREATOR_ROLES = ["admin", "contributor"] as const;

/** Ce que `verifyRequestToken` renvoie, réduit à ce qui sert ici. */
export interface SessionClaims {
  userId: string;
  role: string;
}

/**
 * Assemble le lecteur à partir de la session et du cookie anonyme.
 *
 * La session prime : une star faite en étant connecté s'écrit toujours sous
 * `user_id`, jamais sous `anon_id`, donc aucune ligne anonyme ne peut se créer
 * pendant une session — même si le navigateur porte encore un cookie `sb_anon`.
 */
export function sandboxViewer(
  session: SessionClaims | null | undefined,
  anonId: string | null,
): SandboxViewer {
  if (session) return { kind: "account", userId: session.userId, role: session.role };
  return { kind: "anonymous", anonId };
}

export function isAdmin(viewer: SandboxViewer): boolean {
  return viewer.kind === "account" && viewer.role === "admin";
}

export function isAuthor(sandbox: { user_id: string }, viewer: SandboxViewer): boolean {
  return viewer.kind === "account" && sandbox.user_id === viewer.userId;
}

/** Le score d'évaluation : l'auteur et les admins (§1.6). Un manager, non. */
export function canSeeScore(sandbox: { user_id: string }, viewer: SandboxViewer): boolean {
  return isAuthor(sandbox, viewer) || isAdmin(viewer);
}

/**
 * Un archivé ne sort du listing que pour son auteur et les admins : il est
 * sorti de la vitrine, pas de l'historique de celui qui l'a écrit.
 */
export function canSeeSandbox(
  sandbox: { user_id: string; status: string },
  viewer: SandboxViewer,
): boolean {
  if (sandbox.status !== "archived") return true;
  return canSeeScore(sandbox, viewer);
}

export function canCreateSandbox(role: string | null | undefined): boolean {
  return !!role && (SANDBOX_CREATOR_ROLES as readonly string[]).includes(role);
}

/**
 * L'identité de star correspondant au lecteur, ou `null` s'il n'en a aucune —
 * un visiteur jamais staré, dont le navigateur ne porte pas encore de cookie.
 * `PUT /star` lui en fabrique une ; `DELETE /star` n'a rien à retirer.
 */
export function starIdentity(viewer: SandboxViewer): StarIdentity | null {
  if (viewer.kind === "account") return { kind: "account", userId: viewer.userId };
  return viewer.anonId ? { kind: "anonymous", anonId: viewer.anonId } : null;
}
