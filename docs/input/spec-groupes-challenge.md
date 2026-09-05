# Spec — Travail en groupe sur un challenge

Document de décisions pour implémentation.

**Révision 2** — la v1 de ce document décrivait un groupe qui ne partageait que le crédit (n boards, n branches, n évaluations, un reward divisé). Après relecture du code, ce modèle s'est révélé à la fois plus coûteux à implémenter et incohérent sur le calcul du reward. Le groupe partage désormais le **workspace**. Les sections concernées portent la mention « révisé », et le détail des écarts est en fin de document.

Contexte : les challenges `code` fonctionnent désormais comme les challenges `ml` — kanban libre (chaque contributeur crée ses propres tâches), travail en parallèle sur tout le challenge, évaluation déclenchée par le contributeur lui-même, CP tirés d'un pool qui se draine au fil des évaluations. Certains fichiers de doc décrivent encore l'ancien modèle et sont à mettre à jour (`ml-rewards.md`, `architecture.md`, `challenges-and-tasks.md`, `evaluation.md`).

## Objectif

Permettre à plusieurs contributeurs de travailler ensemble sur un challenge : un workspace partagé, une livraison commune, une contribution créditée à tous les membres, avec un bonus de reward collectif mais une part individuelle réduite.

## Décisions actées

### 1. Scope du groupe : par challenge, pas persistant

- Un groupe existe uniquement dans le cadre d'un challenge. Il se forme au join et meurt naturellement avec lui.
- Pas de groupe global créé depuis le profil, pas de cycle de vie à gérer (départ en cours de route, destruction pendant un challenge actif).

### 2. Le groupe partage le workspace — *révisé*

Le groupe est une **unité de travail**, pas seulement une unité de crédit.

- **Challenge `code`** : un seul kanban pour le groupe, une seule branche (ou un seul repo en mode `own_repo`), une seule évaluation, une seule contribution `project`.
- **Challenge `ml`** : une seule vue de progression — dataset sélectionné ou fourni, URL Kaggle du modèle, URL GitHub du code, endpoint d'API. Une seule contribution par étape.
- Le groupe reste attaché à la **participation**, pas à la contribution : il n'y a pas de choix « celle-ci en groupe, celle-là en solo ». Toutes les contributions du groupe dans ce challenge sont des contributions de groupe.
- Peu importe quel membre agit (soumettre le dataset, déplacer une carte, lancer l'évaluation) : l'action porte sur le workspace du groupe.

### 3. Mécanique d'implémentation : résolveur d'owner — *nouveau*

Le code ancre la propriété sur `user_id` partout (`tasks.user_id`, `contributions.user_id`, `challenge_teams`, `workspace_meta.userUrls[userId]`). Plutôt que d'introduire un second axe (`group_id` sur chaque table, donc deux chemins dans chaque requête et chaque contrôle de permission), on introduit une seule indirection :

```
resolveWorkspaceOwner(challengeId, userId) → userId
```

Elle renvoie le `user_id` **canonique** du groupe — le créateur — si l'appelant a un `group_id` sur ce challenge, sinon l'appelant lui-même.

Conséquences :
- Aucun changement de schéma sur `tasks`, `contributions`, `challenge_repos`.
- Les tâches restent `user_id = <owner>`, la branche reste `contrib/<index>-<slug-du-créateur>`, les URLs ML restent sous `userUrls[ownerId]`.
- Les co-membres agissent sur le slot du porteur.
- On branche le résolveur partout où le code utilise aujourd'hui `session.userId` **comme clé de propriété** — et nulle part où il l'utilise comme identité d'auteur (audit, `created_by`, signaux Slack).

Points d'ancrage identifiés :

| Fichier | Ce qui change |
|---|---|
| `api/tasks/route.ts` | GET `findPersonalTasks(_, ownerId)`, POST `user_id: ownerId`, contrôle du parent |
| `api/tasks/[id]/route.ts` | contrôle `task.user_id === ownerId` sur PATCH/DELETE |
| `api/challenges/[id]/ml-workspace/route.ts` | ~10 occurrences de `session.userId` → `ownerId` (`userUrls`, `datasetUrls`, lookup de contribution) |
| `api/challenges/[id]/workspace/route.ts` | `updateWorkspace(challengeId, ownerId, …)` — champ GitHub du mode `own_repo` |
| `api/challenges/[id]/join/route.ts` | mode groupe (création / rejoint) |
| `packages/services/challenge/code-rewards.service.ts` | `findContribution`, `findByUserAndChallenge`, `participation` → ownerId |
| `packages/services/challenge/ml-rewards.service.ts` + `lineage.ts` | idem |
| `app/challenges/[id]/page.tsx` | `myParticipation`, `myTasks`, `myProjectContribution` |
| `app/tasks/[id]/page.tsx` | `canEdit` |

### 4. Modèle de données

**`challenge_teams.group_id`** (nouvelle colonne, UUID nullable) :
- Deux rows du même challenge avec le même `group_id` = un groupe.
- `null` = solo → comportement actuel strictement inchangé.
- « Détruire le groupe » = remettre les `group_id` à `null`.

**Index unique `(challenge_id, user_id)` sur `challenge_teams`** — à poser dans la même migration. La table n'a aujourd'hui que des index simples : rien n'empêche un double-join, et le join fait un check-then-insert non transactionnel.

**`contribution_members`** (nouvelle table) :
- Colonnes : `contribution_id`, `user_id`, `share_cp`. Clé primaire `(contribution_id, user_id)`.
- Aucune row pour une contribution solo — comportement actuel intact.
- Une row par membre pour une contribution de groupe, écrite au moment du scoring.

**Cumul par delta, pas snapshot.** Sur `code` le scoring est itératif : la même contribution voit son `reward` augmenter à chaque run. À chaque scoring, on répartit **uniquement le delta de CP** entre les membres présents à cet instant :

```sql
INSERT INTO contribution_members (contribution_id, user_id, share_cp)
VALUES (…)
ON CONFLICT (contribution_id, user_id)
DO UPDATE SET share_cp = contribution_members.share_cp + excluded.share_cp
```

Ça respecte « un membre qui rejoint après coup n'est crédité que sur ce qui suit », et l'invariant `Σ share_cp = contributions.reward` tient en permanence.

**`contributions`** : inchangée. `user_id` = le porteur du groupe. `reward` = le total groupe, resynchronisé comme aujourd'hui par le trigger `trg_sync_contribution_reward` (`drizzle/0018_…`).

**`reward_entries`** : inchangé. Le ledger reste au niveau contribution (total groupe), sous le `user_id` du porteur. La division par membre est portée uniquement par `contribution_members.share_cp`. Aucune row ledger par membre.

### 5. Calcul du reward — *révisé*

- Multiplicateur croissant avec la taille mais sous-linéaire : **`1 + 0,4 × (n − 1)`**, **taille max de groupe : 3**.
- À 2 : le groupe gagne 140 % de l'award normal, divisé par 2 → **70 % chacun**.
- À 3 : 180 % divisé par 3 → **60 % chacun**.

Les deux constantes vivent au même endroit que le résolveur d'owner (`GROUP_MAX_SIZE`, `GROUP_MULTIPLIER_STEP`), pas dans les `reward_rules` d'un challenge : c'est un paramètre de plateforme, pas un réglage par challenge.

**Où l'appliquer.** `computeCodeAward` et `computeMlAward` clampent **ligne par ligne** sur un pool décrémenté au fil de la boucle. Le multiplicateur doit donc entrer dans les fonctions pures via un paramètre `groupMultiplier` (défaut `1`) et multiplier le montant brut **avant** le clamp — pas après coup dans le service. Les fonctions restent pures et testables sans base.

**Arrondis.** Les CP sont des entiers : 1300 / 3 = 433,33. Règle retenue : **plus grands restes**, reliquat au porteur du groupe. L'invariant `Σ share_cp = contributions.reward` doit tenir, sinon le leaderboard ne somme plus au total du challenge.

**Effet sur le pool.** Un groupe de 3 draine 1,8× le pool là où 3 solos en draineraient 3×. **Le groupe est économe pour le pool**, pas dispendieux — la v1 de ce document affirmait l'inverse, qui découlait du modèle « n évaluations ». C'est ce qui autorise un `k` plus généreux que les 0,3 proposés initialement.

### 6. Flow de scoring

1. Un membre déclenche l'évaluation (`code`) ou soumet une URL (`ml`).
2. Le service résout l'owner du workspace et travaille sur **la** contribution du groupe.
3. Si le participant est solo (`group_id` null) : flow actuel, rien d'autre.
4. Sinon : award × multiplicateur (dans la fonction pure), clamp pool, écriture du ledger, puis répartition du delta en parts égales dans `contribution_members`.

Le verrou `already_running` sur `contributions.evaluation_status` protège désormais tout le groupe sans travail supplémentaire, puisque la contribution est unique.

### 7. Affichage

- **Manager** : une seule contribution dans la liste — gratuit, il n'y en a qu'une — avec les pastilles/avatars des membres (join sur `contribution_members`, même pattern que `TeamAvatars`) et le reward total.
- **Profil contributeur** : chaque contribution de groupe affiche les pastilles des co-membres ; la part perso vient de `share_cp`.
- **Leaderboard et lectures dérivées** : pour toute contribution ayant des rows `contribution_members`, sommer les `share_cp` par user au lieu de `contributions.reward`.

Quatre chemins somment aujourd'hui par `contribution.user_id` et sont tous à traiter :

| Chemin | Problème |
|---|---|
| `lib/leaderboard.ts` → `aggregateUsersByContribution` | basculer sur `share_cp` ; **et `contributionsCount`**, sinon un co-membre affiche 0 contribution |
| `lib/server/leaderboard.ts` → `fetchContributorProfile` | part de `contribution.findByUser(userId)` : un co-membre **ne voit rien du tout**. Il faut un `findByUserOrMember`, plus `entry.reward` et `contributionShare` sur `share_cp` |
| `lib/server/home.ts` | compte les contributions et le CP par `user_id` |
| `components/challenges/shared/ParticipantsProgress.tsx` | `contributions.find(c => c.user_id === member.id)` — les co-membres afficheraient une ligne vide, 0 tâche, 0 CP. À regrouper par groupe |

### 8. UI de formation du groupe

**Écran de cadrage — déjà livré.** `ChallengeBrief.tsx` rend le premier document du challenge en Markdown à la place du workspace, `shouldShowBrief()` pilote la bascule, `useJoinChallenge` fait le POST. Rien à construire ici.

**Création du groupe.** Sur l'écran de cadrage, deux boutons côte à côte (cf. maquette *Challenge Code Onboarding*) : **Join** (pilule pleine, existant) et **Join as a group** (bouton secondaire, contour), avec la même légende dessous.

« Join as a group » → `POST /join { mode: 'group' }` → join du challenge + création du `group_id`, et la réponse renvoie le token. Une **modale d'invitation** s'ouvre alors : titre « Invite your group », le lien affiché avec un bouton copier, puis « Open the challenge » (ferme et affiche le workspace) et « Cancel ».

**Lien d'invitation.** URL de la page du challenge avec le `group_id` en clair : `/challenges/:id?group=<group_id>`. Partagé par le créateur lui-même (Slack). Pas de token signé ni expirable en v1 : il faut déjà être authentifié, le challenge ouvert et le groupe non plein.

**Rejoindre un groupe.** Ouvrir le lien → **écran de cadrage** (pas le workspace directement : l'arrivant doit lire le brief avant de tomber sur un kanban déjà rempli), avec le bouton principal remplacé par « Rejoindre le groupe de [prénom] ». Un clic → row `challenge_teams` avec le même `group_id`. Pas d'invitation en base, pas d'état pending, pas de notification : le lien est l'invitation. *(Cet écran n'est pas dans la maquette — à dessiner, ou à dériver du bouton secondaire.)*

**Bannière membre.** Une fois dans le groupe, une bannière persistante rappelle l'existence du lien (« Teammates who open it join with their own board, linked to your group ») avec un lien « Show link » qui rouvre la modale. Le `group_id` du viewer doit donc être exposé dans l'overview. *(Le libellé de la maquette dit « Group invite link copied », qui décrit un état post-copie alors que la bannière est permanente — à reformuler.)*

**Garde-fous.**
- Le lien n'est valide que tant que le challenge est ouvert et que le groupe n'a pas atteint la taille max.
- **Un contributeur ayant déjà rejoint en solo ne peut pas basculer en groupe.** Ce n'est plus une simple prudence mais une contrainte structurelle : il a déjà un board copié et une branche provisionnée, qu'il faudrait abandonner ou fusionner. Le clic sur « Join » solo est donc irréversible pour ce challenge — **à dire explicitement dans l'UI au moment du choix**.
- Groupes invisibles : pas de liste de groupes ouverts, un groupe n'est joignable que par lien. Pas de mécanique d'acceptation.

### 9. Concurrence sur le workspace partagé — *nouveau*

Aujourd'hui le sujet n'existe pas : chacun son board. En groupe, deux membres peuvent agir simultanément. Il n'y a pas d'infrastructure temps réel dans le projet, et on n'en ajoute pas (SSE/WebSocket rejeté, cf. *Rejeté*).

**a. Précondition sur le statut — la seule mesure indispensable.**
`ContributorTaskBoard.runStatusChange` fait un déplacement optimiste puis un `PATCH /api/tasks/:id { status }` **aveugle** : ni version, ni précondition. Si Bob passe une carte en `done` et qu'Alice, sur un écran périmé, la déplace de `todo` vers `in_progress`, le `done` de Bob est écrasé silencieusement.

Correction : le PATCH transporte aussi `from_status`, et le repo fait `UPDATE tasks SET status = ? WHERE uuid = ? AND status = ?`. Zéro ligne affectée → **409** avec l'état courant dans le corps. Le client annule son déplacement optimiste (le mécanisme `pending` le fait déjà sur erreur) et affiche « Bob vient de passer cette tâche en Done ».

À noter : `tasks` n'a **pas de colonne `updated_at`**, donc un contrôle de version optimiste demanderait une migration. La précondition sur `status` n'en demande aucune, parce que le statut *est* la donnée disputée.

**b. `refetchOnWindowFocus` sur la query `challenge-overview`.**
Il est désactivé globalement dans `app/providers.tsx`. Un override sur cette seule query suffit et couvre le pattern réel : on ne fixe pas un kanban, on y revient après un aller-retour dans Slack ou l'IDE. Une ligne, zéro requête périodique.

**c. `refetchInterval` — à garder en poche, pas à livrer.**
Le pattern existe déjà sur cette query (`page.tsx`, polling à 3 s pendant une évaluation) ; étendre le prédicat à « je suis en groupe » fait trois lignes. À ajouter le jour où quelqu'un se plaint de voir un board périmé pendant qu'il travaille, pas avant. La correction des données est assurée par (a), pas par la fréquence de rafraîchissement.

### 10. Effets de bord à traiter — *nouveau*

**Protection de branche.** Le join fait `provider.protect(repo, ref, [user.github_username])` : la branche n'est ouverte qu'au créateur. Chaque nouveau membre doit déclencher une **re-protection avec la liste complète** des usernames GitHub du groupe. La signature accepte déjà un tableau. Cas à gérer : le membre qui n'a pas connecté son compte GitHub ne pourra pas pousser — le signaler à l'arrivée dans le groupe.

**« Mes tâches » — sans objet.** `/api/contributors/me/tasks` fait `taskRepo.findByUser(userId)`, donc les co-membres ne verraient rien dans leur page perso. Point abandonné : la page de détail d'une tâche et la section tâches du profil vont être supprimées (décision du 2026-09-05). Rien à corriger de ce côté.

**Reuse intra-groupe : question close.** `lineage.ts` détecte la réutilisation en comparant `contribution.user_id`. Comme le groupe n'a qu'une contribution par étape, on ne peut pas réutiliser son propre artefact — le cas disparaît de lui-même, sans garde à écrire.

## Rejeté

- **Groupe partageant seulement le crédit** (n boards, n branches, n évaluations) : plus cher à implémenter que le workspace partagé, et incohérent sur le reward — `alreadyAwarded` étant indexé par user, chaque membre aurait retouché le fixe et la qualité, faisant du groupe un farm à 1,3× l'award solo par personne.
- **Contributions « miroir » dupliquées par membre** : pollue la liste, complique dedupe/reuse sur les challenges ML.
- **Second axe `group_id` sur `tasks` / `contributions`** : double chaque requête et chaque contrôle de permission, pour un gain limité à la propreté conceptuelle. Le résolveur d'owner fait le même travail sans toucher au schéma existant.
- **Groupe persistant multi-challenges depuis le profil** : cycle de vie trop coûteux pour la v1.
- **Multiplicateur appliqué par le membre via un choix par contribution.**
- **Picker de contributeurs pour former le groupe** : suppose de connaître les inscrits, liste potentiellement longue.
- **Code court à saisir au lieu du lien** : moins fluide, même mécanique.
- **Liste publique des groupes ouverts** : nécessiterait une mécanique d'acceptation.
- **SSE / WebSocket pour le kanban partagé** : aucune infra temps réel dans le projet, canal par challenge et reconnexions à gérer, pour un gain marginal sur un board à trois personnes.

## Questions ouvertes

- **Nommage de la branche de groupe.** `contrib/015-alice-dupont` reste correct mais trompeur pour un groupe. Alternative : `group/015-alice-dupont`. Purement cosmétique, mais visible dans le repo.
- **Écran « Rejoindre le groupe de [prénom] »** : à dessiner, absent de la maquette.
- **Pastilles de co-membres** sur les contributions (manager et profil) : absentes de la maquette également.

## Ce qui a changé depuis la v1 de ce document

| Section v1 | Statut |
|---|---|
| §3 « Périmètre : reward et attribution uniquement — pas de workspace partagé, pas de kanban commun » | **Inversé.** Le workspace est partagé ; le reward devient le morceau facile. |
| §5 « Effet assumé : un groupe draine le pool plus vite » | **Faux.** Un groupe de 3 draine 1,6× le pool contre 3× pour trois solos. |
| §7 « une seule contribution dans la liste (jamais n rows) » | **Gratuit.** Il n'y en a qu'une par construction. |
| §4 « fige la composition au moment du scoring » | **Précisé** en cumul par delta, seule forme compatible avec le scoring itératif de `code`. |
| Question ouverte « interaction groupe × reuse » | **Close.** Sans objet avec une contribution unique par groupe. |
| Question ouverte « format du token d'invitation » | **Tranchée.** Le `group_id` en clair. |
| §8 « écran de cadrage (nouveau) » | **Déjà livré**, seuls le second bouton et la modale manquent. |
