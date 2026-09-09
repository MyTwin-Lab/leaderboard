/**
 * Recherche, filtre et tri du listing sandbox — pur, sans React.
 * --------------------------------------------------------------
 * Extrait de `SandboxExplorer` pour être testable : les composants React ne
 * sont pas testés dans ce dépôt (environnement `node`), la logique l'est.
 *
 * Le tri « Most starred » est calculé ici, côté client, sur le payload complet
 * du listing — il n'y a pas de pagination. Acceptable au volume attendu
 * (quelques dizaines de propositions), à revoir au-delà de quelques centaines
 * (§4.5 du plan).
 */

/** Les deux ordres proposés par la maquette. */
export type SandboxSort = "stars" | "recent";

/**
 * Les trois pills de la maquette. `mine` n'est pas un statut : c'est le
 * filtre « ce que j'ai proposé », qui traverse `open`, `promoted` **et**
 * `archived` — un archivé n'apparaît nulle part ailleurs, et c'est le seul
 * endroit où son auteur le retrouve.
 */
export type SandboxStatusFilter = "open" | "promoted" | "mine";

/**
 * Le minimum dont ce module a besoin. Volontairement structurel plutôt que
 * `SandboxView` : les tests passent des objets nus, et le jour où la vue
 * publique gagne un champ, rien ici n'a à bouger.
 */
export interface FilterableSandbox {
  uuid: string;
  title: string;
  status: string;
  user_id: string;
  context: string | null;
  star_count: number;
  created_at: string | null;
  author: { full_name: string } | null;
}

export interface FilterAndSortOptions {
  query: string;
  status: SandboxStatusFilter;
  sort: SandboxSort;
  /** L'utilisateur connecté, ou `null` — c'est lui que désigne la pill « Mine ». */
  currentUserId: string | null;
}

/** Millisecondes d'une date ISO ; `-Infinity` pour une date absente, qui coule en bas. */
function timeOf(value: string | null): number {
  if (!value) return Number.NEGATIVE_INFINITY;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? Number.NEGATIVE_INFINITY : ms;
}

/**
 * Le sous-ensemble qui correspond à la recherche, tous statuts confondus.
 *
 * Exporté parce que les compteurs des pills se calculent **sur ce pool** et
 * non sur la liste affichée : « Open 4 / Promoted 1 » doit refléter la
 * recherche en cours, sinon les compteurs contrediraient la grille.
 *
 * Trois champs interrogés : le titre, l'auteur et le contexte — l'accroche
 * que la carte affiche. Ni le repo ni les URLs : chercher « github » aurait
 * ramené tout le listing.
 */
export function searchPool<T extends FilterableSandbox>(sandboxes: T[], query: string): T[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...sandboxes];

  return sandboxes.filter((sandbox) => {
    const haystack = [sandbox.title, sandbox.author?.full_name ?? "", sandbox.context ?? ""]
      .join(" ")
      .toLowerCase();
    return haystack.includes(needle);
  });
}

/** Un sandbox appartient-il au lecteur ? Faux pour un visiteur anonyme. */
function isMine(sandbox: FilterableSandbox, currentUserId: string | null): boolean {
  return currentUserId !== null && sandbox.user_id === currentUserId;
}

/** Le compteur de chaque pill, calculé sur le pool déjà filtré par la recherche. */
export function statusCounts<T extends FilterableSandbox>(
  pool: T[],
  currentUserId: string | null,
): Record<SandboxStatusFilter, number> {
  return {
    open: pool.filter((sandbox) => sandbox.status === "open").length,
    promoted: pool.filter((sandbox) => sandbox.status === "promoted").length,
    mine: pool.filter((sandbox) => isMine(sandbox, currentUserId)).length,
  };
}

/**
 * La liste affichée : recherche, puis pill, puis tri.
 *
 * Le tri « stars » départage les égalités par date décroissante — sans ça,
 * l'ordre des sandboxes à zéro star dépendrait de celui du payload, donc
 * changerait à chaque rechargement.
 */
export function filterAndSort<T extends FilterableSandbox>(
  sandboxes: T[],
  { query, status, sort, currentUserId }: FilterAndSortOptions,
): T[] {
  const pool = searchPool(sandboxes, query);

  const filtered =
    status === "mine"
      ? pool.filter((sandbox) => isMine(sandbox, currentUserId))
      : pool.filter((sandbox) => sandbox.status === status);

  return filtered.sort((a, b) => {
    if (sort === "stars" && b.star_count !== a.star_count) return b.star_count - a.star_count;
    return timeOf(b.created_at) - timeOf(a.created_at);
  });
}
