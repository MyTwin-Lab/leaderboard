# Challenges code : boards personnels et évaluation globale

**Date** : 2026-08-28
**Statut** : validé (design approuvé section par section)

## 1. Vision et objectif

Aligner la philosophie des challenges `code` sur celle des challenges `ml` :
**chaque contributeur fait le challenge en entier**, de manière indépendante.

Aujourd'hui, un challenge code est un kanban **global** : les tâches
appartiennent au challenge, les contributeurs se les répartissent (claim,
tâches `solo` verrouillées), chaque tâche a sa branche Git et son évaluation.

Demain, le kanban devient un **outil de travail personnel** : chaque
contributeur qui rejoint le challenge crée et organise ses propres tâches
(todo → in progress → done). Les tâches sont **purement organisationnelles** :
elles n'influencent pas le score. L'évaluation porte sur le **projet global**
du contributeur, déclenchable quand toutes ses tâches sont en done, et les
récompenses suivent le circuit ML (attribution immédiate, ledger, pool qui se
draine).

## 2. Décisions structurantes (validées)

| Sujet | Décision |
|---|---|
| Rôle des tâches | Purement organisationnelles ; aucune influence sur le score |
| Déclenchement de l'évaluation | Par le contributeur, quand toutes ses tâches perso sont en done (≥ 1 tâche) |
| Workspace | Paramètre du challenge à la création : `provided_repo` (repo fourni, branche perso par contributeur) ou `own_repo` (chaque contributeur fournit l'URL de son repo) |
| Moteur de récompense | Circuit ML : attribution immédiate, `reward_entries`, montants absolus clampés au pool restant |
| Formule | Part fixe (livrable recevable) + part variable `cap × note IA / 10`, définies dans le tiroir de règles à la création |
| Itération | Évaluation relançable ; on ne verse que le **delta positif** ; jamais de reprise de points |
| Template admin | L'admin peut (optionnellement) définir des tâches template, copiées dans le board de chaque nouveau contributeur |
| Données existantes | Pas de données réelles à migrer : migrations de structure + reseed de la démo |

## 3. Modèle de données

### 3.1 `challenges` (ajouts)

- `workspace_mode varchar(20)` — `'provided_repo' | 'own_repo'`. Choisi à la
  création, pertinent uniquement pour `type='code'`. En mode `provided_repo`,
  le challenge garde son `challenge_repos` (repo GitHub) ; en mode `own_repo`,
  aucun repo n'est créé à la création.
- `reward_rules` (colonne JSON existante) : nouveau schéma zod versionné
  **code**, frère du schéma ML (`codeRewardRules.ts` à côté de
  `mlRewardRules.ts`) :

  ```jsonc
  { "version": 1, "delivery": { "fixed": 50, "cap": 150 } }
  ```

### 3.2 `tasks` (transformation)

- **Ajout** `user_id uuid` → `users`, `on delete cascade`, **nullable** :
  - `NULL` = tâche **template** (définie par l'admin/manager) ;
  - non-null = tâche du board personnel de ce contributeur.
- `status` stocké : `'todo' | 'in_progress' | 'done'` (plus de colonne
  dérivée de la présence d'un assigné).
- **Supprimés** : `type` (`solo`/`concurrent`), `repo_id`.
- **Conservés** : `parent_task_id` (sous-tâches), `title`, `description`,
  `challenge_id`, `created_at`.

### 3.3 `challenge_teams` (devient la participation)

Ajout du workspace personnel :

- `workspace_provider varchar(32)` — `'github'` (mode `provided_repo`) ou
  `'external'` (mode `own_repo`)
- `workspace_ref varchar(200)` — branche perso provisionnée, ex.
  `refs/heads/contrib/<username>` (mode `provided_repo` uniquement)
- `workspace_url text` — URL de la branche provisionnée, ou URL du repo
  fourni par le contributeur (mode `own_repo`)
- `workspace_status varchar(20)` — `pending | ready | failed`

L'état d'évaluation ne vit **pas** ici : il vit sur la contribution (comme en
ML).

### 3.4 `contributions` (réutilisée telle quelle)

Une contribution par `(challenge_id, user_id, type='project')` — pendant
exact des types `dataset`/`model`/`api_packaging` du ML :

- `artifact_url` = URL de la branche/du repo évalué
- `evaluation` = résultat de la grille (scores + note globale)
- `evaluation_status` = `pending | running | done | failed` (pollé par l'UI)
- `reward` = synchronisé par le trigger DB existant depuis le ledger

### 3.5 `reward_entries` (réutilisé tel quel)

Deux nouveaux `rule_key` : `code_fixed` et `code_quality`.
`meta` : `{ agentScore, rawPoints, clampedTo, artifactUrl }` — le breakdown
existant (`GET /api/contributions/[id]/rewards`) fonctionne sans modification.

### 3.6 Supprimés du schéma

- `task_assignees` (le propriétaire est sur la tâche)
- `task_workspaces` (le workspace est sur la participation)

Migration SQL de structure uniquement, puis reseed de la démo.

## 4. Flux contributeur

### 4.1 Rejoindre

`POST /api/challenges/[id]/join` (existant, aujourd'hui sans appelant UI)
devient le point d'entrée, avec un bouton « Rejoindre » sur la page challenge :

1. Insertion `challenge_teams`.
2. Mode `provided_repo` : provisionnement de la branche perso
   `contrib/<username>` via le provisionneur existant (protection de branche
   pour le contributeur, statut `pending → ready`) — mécanique de
   `provisionTaskWorkspace` déplacée de la tâche vers la participation.
3. Mode `own_repo` : rien à provisionner ; le contributeur renseigne l'URL de
   son repo depuis son board (modifiable, requise avant évaluation).
4. Copie du template : chaque tâche `user_id NULL` est dupliquée en tâche
   perso (`user_id = moi`, `status = 'todo'`). Sans template : board vide.

### 4.2 Travailler sur son board

- Kanban existant (`ContributorTaskBoard`, dnd-kit) alimenté par **mes**
  tâches uniquement, statut **stocké** : le drag & drop fait un
  `PATCH /api/tasks/[id]` du statut. Plus d'appel à `/assign`, plus de
  provisionnement au drag.
- CRUD complet sur ses propres tâches (créer, éditer, supprimer,
  sous-tâches). Interdit de toucher aux tâches des autres ou au template.
- L'admin/manager gère le template via l'éditeur existant (tâches
  `user_id NULL` uniquement).
- Visibilité : le contributeur voit son board ; la vue manage montre la
  progression par participant (x/y done, statut d'évaluation, points). Pas de
  consultation du board détaillé des autres en v1.

### 4.3 Lancer l'évaluation globale

Bouton « Lancer l'évaluation », activé quand : **≥ 1 tâche perso ET toutes en
done ET workspace prêt** (branche `ready` ou URL renseignée selon le mode).

`POST /api/challenges/[id]/project-evaluation` :

1. Vérifie les préconditions + refuse si un run est déjà `running` pour ce
   contributeur.
2. Upsert de la contribution `(challenge, moi, 'project')` avec
   `artifact_url`, statut `pending`.
3. Fire-and-forget (pattern `scheduleAward` du ML) : snapshot de la
   branche/du repo (pipeline de `task-evaluation.service` réutilisé :
   connexion, ≤ 100 commits, snapshot agrégé, grille `code`) → note /10 →
   calcul des points → delta → écriture ledger → statut `done`.
4. L'UI polle `evaluation_status` (pattern `MLChallengeFlow`).

### 4.4 Itérer

Après une évaluation, le contributeur peut rajouter des tâches (board
« incomplet », bouton désactivé), améliorer son code, tout repasser en done et
relancer. Chaque run ne verse que le delta positif. Garde-fou v1 : une seule
évaluation `running` à la fois par contributeur.

### 4.5 Effets de bord

- `challenges.completion` (code) = fraction du pool drainé (comme ML), au
  lieu du ratio de tâches done.
- `POST /api/challenges/[id]/close` ne calcule plus de récompenses pour le
  code : clôturer ferme juste le challenge.

## 5. Évaluation & récompenses

### 5.1 Calcul

Un run produit une note IA **sur 10** (grille `code` via
`OpenAIAgentEvaluator`, note globale normalisée /10) puis deux lignes
potentielles de ledger :

| `rule_key` | Points bruts | Quand |
|---|---|---|
| `code_fixed` | `rules.delivery.fixed` | livrable recevable = l'évaluation aboutit |
| `code_quality` | `rules.delivery.cap × note / 10` | à chaque run |

**Formule de delta unique**, par `rule_key` :

```
versé = max(0, brut − Σ lignes existantes (challenge, user, rule_key))
```

clampé au pool restant (`pool − Σ ledger hors slack_signal`, réutilisé de
`MlRewardsService.remainingPool`). Conséquences :

- Le fixe est versé au premier run réussi, puis son delta vaut 0 — aucune
  logique « première fois » à coder.
- Note qui monte (6 → 8) : versement de `cap × 2/10`. Note qui baisse :
  delta négatif → 0 versé, rien repris.

### 5.2 Implémentation

- **`computeCodeAward()`** : fonction pure dans
  `packages/evaluator/code-reward.ts` (sœur de `ml-reward.ts`). Entrées
  `(rules, note, existingEntriesByRuleKey, remainingPool)` → sorties
  `RewardEntryDraft[]`. Testée unitairement.
- **`CodeRewardsService`** dans `packages/services/challenge/`, calqué sur
  `MlRewardsService` : `scheduleAward` fire-and-forget, statuts sur la
  contribution, écriture via `createManyAndSyncRewards`, mise à jour de
  `challenges.completion = 1 − restant/pool`.
- **Snapshot** : pipeline de `task-evaluation.service` pointé sur la branche
  perso (`provided_repo`) ou le repo du contributeur (`own_repo`).

### 5.3 Cas limites

- **Pool épuisé** : l'évaluation tourne (note visible), versement 0.
- **Évaluation échouée** (repo inaccessible, erreur agent) : statut `failed`,
  aucune ligne de ledger, relance libre.
- **Mode `own_repo`** : repo GitHub **public** requis en v1 (accès privé via
  token/GitHub App hors scope).
- **Course sur la fin du pool** : même voie transactionnelle que le ML —
  premier écrit, premier servi, le second est clampé.

### 5.4 Code supprimé

- `RewardsService` / `computeRewards` (répartition relative à la clôture) et
  leur appel dans `POST /close`.
- `POST /api/tasks/[id]/evaluate` et `PATCH /api/tasks/[id]/complete`.

## 6. Surfaces UI

### 6.1 Page challenge (contributeur) — `challenges/[id]/page.tsx`

Onglet Tasks → **« Mon board »** :

- **Non-membre** : bouton « Rejoindre le challenge » + aperçu des tâches
  template (teaser du programme).
- **Membre** : kanban perso (`ContributorTaskBoard` refondu — drag & drop =
  PATCH de statut, plus d'états `assigning/evaluating`), bouton « Nouvelle
  tâche » (réutilisation de `TaskForm` en version allégée pour les
  contributeurs).
- **Panneau workspace** : lien vers la branche perso (`provided_repo`) ou
  champ URL de repo (`own_repo`, pattern `RepoSubmission`).
- **Bloc évaluation** : bouton « Lancer l'évaluation » (désactivé avec raison
  affichée : tâches restantes, workspace pas prêt, run en cours), progression
  par polling, puis note /10, points reçus et breakdown ledger.

### 6.2 Détail de tâche — `tasks/[id]/page.tsx`

Simplifié : titre, description, sous-tâches. Supprimés : workspaces,
assignés, boutons Évaluer et Complete. Éditable par le propriétaire (ou
manager pour le template).

### 6.3 Vue manage — `ChallengeManageView`

- `ChallengeTasksEditor` manipule le **template** (tâches `user_id NULL`).
- Nouveau panneau **Participants** : progression (x/y done), statut
  workspace, dernière note, points versés.
- Panneau **pool** : réutilisation de `GET /api/challenges/[id]/ml-rewards`
  (somme du ledger contre le pool, rien de spécifique ML), affiché pour les
  challenges code.

### 6.4 Création de challenge (admin)

Pour `type='code'` : choix du `workspace_mode` (repo GitHub à fournir si
`provided_repo`) ; le tiroir de règles de récompense gagne le variant code
(`fixed` + `cap`) à côté du variant ML.

### 6.5 API — récapitulatif

| Changement | Routes |
|---|---|
| Modifiées | `POST /join` (provisionnement + copie template), `GET/POST /api/tasks` (scope perso/template, droits), `PATCH /api/tasks/[id]` (statut stocké, ownership), `GET /overview` (board perso au lieu du board global) |
| Nouvelles | `POST /api/challenges/[id]/project-evaluation`, `PATCH /api/challenges/[id]/workspace` (URL du repo perso, mode `own_repo`) |
| Supprimées | `POST /api/tasks/[id]/assign`, `POST /api/tasks/[id]/evaluate`, `PATCH /api/tasks/[id]/complete` |

## 7. Tests (Vitest, co-localisés)

1. **`computeCodeAward`** (fonction pure) : premier run, delta positif, note
   qui baisse → 0, fixe versé une seule fois, clamp au pool, pool vide.
2. **Services** : copie du template au join (avec et sans template),
   préconditions d'évaluation (board incomplet, workspace absent, run
   concurrent), pipeline d'award avec agent/provisionneur mockés (pattern des
   tests ML).
3. **Routes** : ownership des tâches (403 sur la tâche d'un autre), guards de
   rôle sur le template.
4. **Seed démo** : un challenge code par mode (`provided_repo` / `own_repo`)
   avec participants à différents stades (board en cours, évalué, itéré).

## 8. Hors scope (v1)

- Accès aux repos privés en mode `own_repo` (token/GitHub App).
- Consultation du board détaillé des autres contributeurs.
- Lineage/réutilisation façon ML (propre au ML).
- Limitation fine du spam d'évaluations (cooldown) — seul garde-fou : un run
  `running` à la fois par contributeur.
- Migration de données (aucune donnée réelle).
