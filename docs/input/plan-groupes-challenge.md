# Plan d'implémentation — Travail en groupe sur un challenge

Compagnon de `spec-groupes-challenge.md` (révision 2). La spec dit *quoi* et *pourquoi* ; ce document dit *dans quel ordre* et *avec quels pièges*.

**Principe directeur : tout est inerte tant que le lot 4 n'est pas livré.** Aucun chemin utilisateur ne peut créer de `group_id` avant la route de join groupée. Les lots 1 à 3 sont donc mergeables un par un sur `main` sans changement visible : `group_id = null` partout signifie « comportement actuel, strictement ». C'est ce qui permet de livrer le morceau risqué (le reward) tôt et testé, sans attendre l'UI.

---

## Lot 1 — Fondations : schéma, repositories, résolveur

Aucune logique métier, uniquement la plomberie sur laquelle tout le reste s'appuie.

### 1.1 Migration `drizzle/0019_challenge_groups.sql`

```sql
ALTER TABLE "challenge_teams" ADD COLUMN IF NOT EXISTS "group_id" uuid;

CREATE INDEX IF NOT EXISTS "idx_challenge_teams_group"
  ON "challenge_teams" USING btree ("challenge_id", "group_id");

CREATE UNIQUE INDEX IF NOT EXISTS "idx_challenge_teams_unique"
  ON "challenge_teams" USING btree ("challenge_id", "user_id");

CREATE TABLE IF NOT EXISTS "contribution_members" (
  "contribution_id" uuid NOT NULL,
  "user_id"         uuid NOT NULL,
  "share_cp"        integer NOT NULL DEFAULT 0,
  CONSTRAINT "contribution_members_pk" PRIMARY KEY ("contribution_id", "user_id")
);
-- FK cascade vers contributions et users, + index sur user_id (lecture leaderboard)
```

> ⚠️ **Bloquant possible.** `challenge_teams` n'a aujourd'hui aucune contrainte d'unicité et le join fait un check-then-insert non transactionnel : la base **peut** contenir des doublons. L'index unique échouera dessus. Faire tourner d'abord :
>
> ```sql
> SELECT challenge_id, user_id, count(*) FROM challenge_teams
> GROUP BY 1,2 HAVING count(*) > 1;
> ```
>
> Si ça renvoie des lignes, dédupliquer dans la migration (garder la row qui porte un `workspace_ref`, sinon n'importe laquelle) avant de créer l'index.

### 1.2 Schéma et domaine

- `db/drizzle.ts` : colonne `group_id` sur `challenge_teams`, table `contribution_members`, relations.
- `domain/entities.ts` : `ChallengeTeam.group_id`, nouveau type `ContributionMember`.
- `domain/schemas_zod.ts` : `challengeTeamSchema` étendu, `contributionMemberSchema`.
- `db/mappers.ts` : `toDomainContributionMember`.

### 1.3 Repositories

- `challengeTeam.repo.ts` : `create()` accepte `group_id` ; ajout de `findByGroup(challengeId, groupId)`, `countByGroup(challengeId, groupId)`, `updateGroup(challengeId, userId, groupId)`.
- **Nouveau** `contributionMember.repo.ts` : `findByContribution`, `findByContributions(ids[])`, `findAll()`, `findContributionIdsByUser(userId)`, et surtout :

```ts
upsertManyAdditive(rows: { contribution_id, user_id, share_cp }[]): Promise<void>
// INSERT … ON CONFLICT (contribution_id, user_id)
// DO UPDATE SET share_cp = contribution_members.share_cp + excluded.share_cp
```

- `repositories/index.ts` : export.

### 1.4 Le résolveur — `packages/services/challenge/group.ts`

Module unique, sans état, importable depuis les services **et** les routes API.

```ts
export const GROUP_MAX_SIZE = 3;
export const GROUP_MULTIPLIER_STEP = 0.4;

export function groupMultiplier(size: number): number   // 1 + 0.4 × (min(size, 3) − 1)
export async function resolveWorkspaceOwner(challengeId, userId): Promise<string>
export async function getGroupContext(challengeId, userId):
  Promise<{ ownerId: string; groupId: string | null; memberIds: string[] }>
```

`getGroupContext` est la vraie porte d'entrée : elle fait **une** requête (`findByChallenge`) et en dérive l'owner, le `group_id` et la liste des membres — évite de requêter trois fois sur le chemin chaud du scoring. `resolveWorkspaceOwner` est le raccourci pour les routes qui n'ont besoin que de l'owner.

L'owner canonique est **le créateur du groupe**. Il faut donc pouvoir le distinguer : soit une colonne, soit une convention. **Retenu : convention** — le créateur est celui dont la row porte un `workspace_ref`/`workspace_url` (les rejoignants n'en ont pas). En repli déterministe si aucune ne l'a encore (provisioning en échec), prendre le `MIN(user_id)`. Pas de colonne supplémentaire.

### 1.5 Tests

`packages/services/challenge/group.test.ts` — multiplicateur (1 / 1,4 / 1,8 / plafonné à 4+), résolution solo → soi-même, résolution groupe → créateur, repli `MIN(user_id)`.

**Taille : M.** Mécanique, mais la migration demande une vérification en base au préalable.

---

## Lot 2 — Reward : multiplicateur et parts

Le morceau le plus risqué, et entièrement testable sans base ni réseau — le pattern d'injection de dépendances existe déjà (`CodeRewardsDeps`, `MlRewardsDeps`), et `code-reward.test.ts` / `code-rewards.service.test.ts` donnent le modèle.

### 2.1 Fonctions pures

**`packages/evaluator/code-reward.ts`** — nouveau champ `groupMultiplier?: number` (défaut 1) sur `CodeAwardInput`. Il multiplie le **brut**, avant le calcul du delta et avant le clamp :

```ts
{ rule_key: "code_fixed",   raw: Math.round(rules.delivery.fixed * mult), … }
{ rule_key: "code_quality", raw: Math.round((rules.delivery.cap * score * mult) / 10), … }
```

> **Effet voulu à documenter :** le delta est `raw − already`. Si un membre rejoint entre deux runs, `mult` augmente, donc `raw` augmente, donc un delta positif apparaît au run suivant. Le groupe qui grandit touche le complément — c'est cohérent avec le ledger append-only, mais ça mérite un commentaire dans le code, sinon ça se lit comme un bug.

**`packages/evaluator/ml-reward.ts`** — même paramètre.

> ⚠️ **Ne pas multiplier les lignes de reuse.** `computeMlAward` émet des lignes créditant d'autres users (`source_user_id`) et la déduction correspondante. Le bonus de groupe porte sur l'award produit, pas sur la redistribution : appliquer `mult` uniquement au montant de la règle principale, avant que la mécanique de reuse ne prélève dessus.

**Nouveau `packages/evaluator/share.ts`** :

```ts
export function splitShares(total: number, memberIds: string[], ownerId: string): Map<string, number>
```

Plus grands restes, reliquat au porteur. Invariant testé : `Σ = total`, y compris pour un total négatif ou nul, et pour `memberIds.length === 1`.

### 2.2 Services

**`code-rewards.service.ts`**
- `canEvaluate` et `evaluate` : `getGroupContext` en tête, puis `participation`, `findContribution` et `findByUserAndChallenge` sur `ownerId`.
- La contribution `project` est créée avec `user_id: ownerId`.
- `computeCodeAward({ …, userId: ownerId, groupMultiplier: groupMultiplier(memberIds.length) })`.
- Après `createManyAndSyncRewards`, si `memberIds.length > 1` : `delta = drafts.reduce((s, d) => s + d.points, 0)` puis `upsertManyAdditive(splitShares(delta, memberIds, ownerId))`.

**`ml-rewards.service.ts`** — même chose, à une nuance près : le delta du groupe est `drafts.filter(d => d.user_id === ownerId).reduce(…)`, pas la somme de tous les drafts, puisque les lignes de reuse créditent des tiers.

**`lineage.ts`** — comparaisons sur `ownerId`.

### 2.3 Tests

- `code-reward.test.ts` : multiplicateur × delta itératif × clamp de pool, dans cet ordre.
- `share.test.ts` : invariant de somme sur une batterie de cas.
- `code-rewards.service.test.ts` : un scénario groupe de bout en bout avec fakes — deux membres, deux runs, un troisième membre entre les deux.

**Taille : L.** C'est le cœur, et c'est là que les tests doivent être denses.

---

## Lot 3 — Ownership : le refactor mécanique

Aucune invention, uniquement le branchement du résolveur. Le tableau §3 de la spec liste les points ; ordre suggéré, du plus isolé au plus large :

1. `api/challenges/[id]/workspace/route.ts` — un seul appel (`updateWorkspace`).
2. `api/tasks/[id]/route.ts` — contrôle de propriété sur PATCH/DELETE, plus le contrôle de cohérence du parent.
3. `api/tasks/route.ts` — GET, POST, contrôle du parent.
4. `api/challenges/[id]/ml-workspace/route.ts` — le gros morceau (~10 sites : `userUrls`, `datasetUrls`, lookup de contribution, `scheduleAward`).
5. Front : `app/challenges/[id]/page.tsx` (`myParticipation`, `myTasks`, `myProjectContribution`) et `app/tasks/[id]/page.tsx` (`canEdit`).

> **Règle de tri, à appliquer à chaque occurrence :** `session.userId` devient `ownerId` quand il sert de **clé de propriété** (à qui appartient ce board, ce slot, cette contribution). Il reste `session.userId` quand il sert d'**identité d'auteur** — audit, `created_by`, signaux Slack, tracking d'onboarding. En cas de doute : est-ce qu'un co-membre doit voir/modifier cette chose ? Si oui, c'est une clé de propriété.

Côté front, `ownerId` doit venir du serveur : ajouter `my_workspace_owner_id` à la réponse d'overview pour un utilisateur authentifié, plutôt que de le recalculer dans le composant.

**Taille : M.** Volumineux mais sans réflexion, et le lot 2 en a déjà validé la sémantique côté services.

---

## Lot 4 — Join groupé et garde-fous

Premier lot visible pour un utilisateur, mais toujours sans UI : testable au curl.

`POST /api/challenges/[id]/join` accepte désormais un corps optionnel `{ mode?: 'solo' | 'group', group?: string }` :

- **`mode` absent ou `'solo'`** : chemin actuel, inchangé.
- **`mode: 'group'` sans `group`** : `group_id = randomUUID()`, puis copie du board et provisioning **comme aujourd'hui**. Le créateur est un participant normal qui porte en plus un `group_id`. Réponse enrichie de `{ group_id }`.
- **`group` fourni** : c'est un *rejoint*. Validations, dans l'ordre :
  1. challenge ouvert (déjà en place) ;
  2. l'appelant n'est pas déjà participant → sinon **409** avec un message explicite (« vous participez déjà en solo à ce challenge ») ;
  3. le `group_id` existe bien sur **ce** challenge ;
  4. `countByGroup < GROUP_MAX_SIZE`.

  Puis : insertion de la row avec le `group_id`, **sans copie de board et sans provisioning** — le workspace est celui du porteur.

- **Re-protection de la branche** (mode `provided_repo` uniquement) : charger les `github_username` de tous les membres et rappeler `provider.protect(parentRef, ref, usernames)`. La signature prend déjà un tableau. Un membre sans compte GitHub connecté est ignoré de la liste — la réponse doit le signaler pour que l'UI l'affiche, sinon il découvrira son `403` en poussant.

> **Course sur la taille max.** L'index unique du lot 1 ferme le double-join. Le dépassement du cap par deux `POST` simultanés reste possible : **cap souple assumé**, documenté ici. Le verrouiller demanderait une transaction sérialisable pour un scénario à trois personnes.

**Taille : M.**

---

## Lot 5 — Lectures : leaderboard, profil, accueil, participants

Sans ce lot, les CP d'un groupe semblent disparaître pour les co-membres. À livrer **immédiatement après** le lot 4, ou dans la même PR.

- **`lib/leaderboard.ts` → `aggregateUsersByContribution`** : nouveau paramètre `contributionMembers`. Pour chaque contribution, si elle a des membres → créditer chacun de son `share_cp` **et** incrémenter le compteur de contributions de chacun ; sinon comportement actuel. C'est le compteur qu'on oublie.
- **`lib/server/leaderboard.ts`** : `fetchLeaderboard` charge les membres ; `fetchContributorProfile` passe à un `findByUserOrMember(userId)`, et affiche `share_cp` au lieu de `contribution.reward` pour `entry.reward` comme pour `contributionShare`.
- **`lib/server/home.ts`** : même traitement sur le comptage et le CP.
- **`components/challenges/shared/ParticipantsProgress.tsx`** : regrouper les lignes par `group_id` — une ligne par groupe, avatars empilés, un seul board, un seul CP. Sans ça, les co-membres apparaissent avec 0 tâche et 0 CP.

> 🔒 **`toPublicOverview` ne doit pas exposer `group_id`.** C'est le token d'invitation : le publier à un visiteur anonyme rendrait tout groupe joignable sans lien. Le fichier est en liste blanche explicite — il suffit de ne pas l'ajouter, mais c'est à vérifier consciemment.

**Taille : M.**

---

## Lot 6 — Concurrence sur le board partagé

Indépendant des groupes, livrable avant ou après. Bénéfice immédiat : ferme aussi une mise à jour perdue théorique sur un board solo ouvert dans deux onglets.

- **`task.repo.ts`** : `update(uuid, entity, opts?: { expectedStatus })` → ajoute `AND status = ?` au `WHERE`, retourne `null` si zéro ligne affectée.
- **`api/tasks/[id]/route.ts`** : accepte `from_status` optionnel. Si l'update renvoie `null` → **409** avec `{ error, task }` où `task` porte l'état réel.
- **`ContributorTaskBoard.runStatusChange`** : envoie `from_status: task.status`, et sur 409 annule le déplacement optimiste (le mécanisme `pending` le fait déjà sur erreur) en affichant « Cette tâche vient de passer en *Done* ».
- **`app/challenges/[id]/page.tsx`** : `refetchOnWindowFocus: true` en override sur la query `challenge-overview` uniquement.

Le `refetchInterval` **n'est pas livré** — décision §9c de la spec.

**Taille : S.**

---

## Lot 7 — UI de formation du groupe

- **`JoinButton`** : variante `secondary` (contour), pour ne pas dupliquer le composant.
- **`ChallengeBrief`** : les deux boutons côte à côte, légende inchangée dessous. Le bouton solo porte l'avertissement d'irréversibilité (§8 de la spec) — au survol ou en légende, à voir au moment de l'intégration.
- **`useJoinChallenge`** : accepte un `mode`, retourne le `group_id` de la réponse.
- **Nouveau `GroupInviteModal`** : titre, lien en champ lecture seule, bouton copier avec état « Copié », « Open the challenge » et « Cancel ». Calqué sur la maquette *Challenge Code Onboarding*.
- **Arrivée par lien** : lecture de `?group=` sur la page challenge → bouton principal remplacé par « Rejoindre le groupe de [prénom] ».

> 🔒 **Ne pas dériver le prénom du porteur depuis l'overview.** Ça supposerait d'exposer les `group_id` à tout utilisateur connecté, donc de rendre chaque groupe joignable sans lien. Créer un endpoint dédié :
>
> ```
> GET /api/challenges/:id/group/:token → { ownerName, size, joinable, reason? }
> ```
>
> Il ne répond que pour un token exact, ne liste rien, et porte les quatre validations du lot 4 pour que l'écran affiche la bonne raison quand le groupe est plein ou le challenge fermé.

- **Bannière membre** : visible quand `group_id` est non nul, avec « Show link » qui rouvre la modale. Reformuler le libellé de la maquette (« Group invite link copied » décrit un état post-copie alors que la bannière est permanente).

**Taille : L.** Une modale, un endpoint, un état d'arrivée, une bannière.

---

## Lot 8 — Pastilles de co-membres

- Exposer `contribution_members` (user_id + nom + avatar) dans l'overview et dans la réponse de profil.
- **Manager** (`ChallengeManageView`, onglet Contributions) : `TeamAvatars` sur la ligne, reward total.
- **Profil** (`ContributionDashboard`) : mêmes pastilles, part perso depuis `share_cp`.

Aucune maquette n'existe pour ces deux écrans — à cadrer visuellement avant d'écrire.

**Taille : S**, une fois le lot 5 en place (les données sont déjà chargées).

---

## Lot 9 — Documentation

`ml-rewards.md`, `architecture.md`, `challenges-and-tasks.md` et `evaluation.md` décrivent encore l'ancien modèle de reward (split proportionnel à la clôture) — dette antérieure à ce chantier, mais qui devient trompeuse une fois les groupes en place. Ajouter la section « travail en groupe » et corriger ces quatre fichiers.

**Taille : S.**

---

## Récapitulatif des risques

| # | Risque | Lot | Parade |
|---|---|---|---|
| 1 | Doublons existants dans `challenge_teams` bloquant l'index unique | 1 | Requête de vérification **avant** d'écrire la migration ; déduplication dedans si besoin |
| 2 | Multiplicateur qui change entre deux runs → delta positif « surprise » | 2 | Comportement voulu, à commenter dans le code |
| 3 | Multiplicateur appliqué par erreur aux lignes de reuse ML | 2 | Test dédié sur `computeMlAward` avec lineage |
| 4 | `Σ share_cp ≠ contributions.reward` sur les arrondis | 2 | Invariant testé dans `share.test.ts` |
| 5 | `group_id` exposé à un non-invité → groupe joignable sans lien | 5, 7 | Absent de `toPublicOverview` ; endpoint dédié par token au lieu de l'overview |
| 6 | Membre sans `github_username` incapable de pousser | 4 | Le join renvoie l'info, l'UI l'affiche |
| 7 | Cap de taille dépassé par deux joins simultanés | 4 | Cap souple assumé |

## Ordre de livraison

```
1 (fondations) → 2 (reward) → 3 (ownership) → 4 (join) + 5 (lectures) ensemble
                                                    ↓
                                     6 (concurrence) — indépendant, quand on veut
                                                    ↓
                                          7 (UI) → 8 (pastilles) → 9 (docs)
```

Les lots 1 à 3 sont invisibles et mergeables un par un. Les lots 4 et 5 forment la première livraison réellement fonctionnelle — un groupe se crée au curl, travaille, est scoré, et le CP apparaît au bon endroit. Le lot 7 le rend utilisable sans curl.
