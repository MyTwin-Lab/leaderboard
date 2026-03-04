# Feuille de route — Discord Leaderboard

## Phase 0 — Cadrage (Toute l'équipe)

| # | Tâche | Qui |
|---|-------|-----|
| 0.1 | Définir le **format de payload** échangé entre le bot Discord et l'API | Tous |
| 0.2 | Définir le **contrat d'interface** API ↔ LLM : ce que les data IA reçoivent (conversation formatée) et ce qu'ils retournent (score structuré) | Tous |
| 0.4 | Définir le **flow de liaison** `discord_id` ↔ `user` existant en DB (compte existant ou création à la volée ?) | Dev + PO |
| 0.5 | Valider la **liste de mots-clés** GRATITUDE et HELP_REQUEST (FR + EN) avec l'équipe | Tous |

---

## Phase 1 — Base de données (Dev)

> S'appuie sur le schéma Drizzle existant dans `packages/database-service/db/drizzle.ts`

| # | Tâche | Qui |
|---|-------|-----|
| 1.1 | Ajouter la table **`discord_accounts`** (`discord_id`, `username`, `user_id FK`) | Dev |
| 1.2 | Ajouter la table **`conversations`** (`conversation_id`, `channel_id`, `helper_discord_id FK`, `beneficiary_discord_id FK`, `start_message_id`, `end_message_id`, `started_at`) | Dev |
| 1.3 | Ajouter la table **`messages`** (`message_id`, `conversation_id FK`, `author_discord_id FK`, `content`, `sent_at`) | Dev |
| 1.4 | Ajouter la table **`triggers`** (`trigger_id`, `message_id FK`, `trigger_type`, `keyword_detected`, `language`) | Dev |
| 1.5 | Vérifier si les tables **`evaluation_runs`** et **`evaluation_grids`** existantes peuvent être réutilisées ou s'il faut en créer de nouvelles dédiées Discord | Dev |
| 1.6 | Ajouter la table **`discord_scores`** liée à `users` et `evaluation_runs` | Dev |
| 1.7 | Générer la **migration Drizzle** et la documenter | Dev |
| 1.8 | Écrire les **repositories** pour chaque nouvelle table (pattern existant dans `packages/database-service/repositories/`) | Dev |

---

## Phase 2 — Bot Discord (Dev)

> Nouveau package `packages/connectors/discord` en suivant le pattern `connectors/`

| # | Tâche | Qui |
|---|-------|-----|
| 2.1 | Setup du bot Discord (token, permissions, canaux écoutés) | Dev |
| 2.2 | Implémenter la **détection HELP_REQUEST** → créer `CONVERSATION` + `TRIGGER` en DB | Dev |
| 2.3 | Implémenter la **logique d'identification des rôles** : qui est le helper, qui est le beneficiary (celui qui a posé la question) | Dev |
| 2.4 | Implémenter la **délimitation de l'historique** : `start_message_id` = premier message de demande, `end_message_id` = message de remerciement | Dev |
| 2.5 | Implémenter la **détection GRATITUDE** → clore la conversation + envoyer la conversation à l'API pour évaluation | Dev |
| 2.6 | Gérer les **cas limites** : conversation sans réponse, plusieurs helpers, timeout si pas de remerciement | Dev |

---

## Phase 3 — API (Dev)

> Nouveaux endpoints dans `apps/leaderboard-client/src/app/api/` ou dans `packages/services/`

| # | Tâche | Qui |
|---|-------|-----|
| 3.1 | `POST /api/discord/trigger` — reçoit un trigger détecté par le bot et l'enregistre | Dev |
| 3.2 | `GET /api/discord/conversations/:id` — expose la conversation formatée pour le LLM | Dev |
| 3.3 | `POST /api/discord/evaluation-result` — reçoit le score du LLM et l'enregistre | Dev |
| 3.4 | Créer le **service d'orchestration** : trigger reçu → appel LLM → score → attribution points (pattern `packages/services/`) | Dev |
| 3.5 | Sécuriser les endpoints bot + LLM (token partagé ou IP whitelist) | Dev |

---

## Phase 4 — Évaluation LLM (Data IA)

> S'appuie sur le contrat défini en Phase 0 et les endpoints Phase 3

| # | Tâche | Qui |
|---|-------|-----|
| 4.1 | Définir et documenter le **prompt système** utilisé pour évaluer une conversation | Data IA |
| 4.2 | Implémenter le **pipeline d'évaluation** : réception de la conversation → analyse → score structuré | Data IA |
| 4.3 | Ajouter une grille **`discord_help`** dans `packages/evaluator/grids/` en suivant le pattern existant (`code`/`model`/`dataset`), avec les critères : clarté de l'aide, résolution du problème, réactivité | Data IA |
| 4.4 | Implémenter l'**appel au endpoint** `POST /api/discord/evaluation-result` avec le score | Data IA |
| 4.5 | Gérer les **cas d'ambiguïté** : aide insuffisante, conversation trop courte, hors sujet | Data IA |

---

## Phase 5 — Frontend (Dev)

| # | Tâche | Qui |
|---|-------|-----|
| 5.1 | Intégrer les scores Discord dans le **leaderboard existant** | Dev |
| 5.2 | Page **profil** : section "Aide Discord" avec historique des contributions | Dev |
| 5.3 | Page **admin** : visualisation des évaluations Discord (conversation, trigger, score attribué, statut) | Dev |
| 5.4 | Flow de **liaison compte Discord** sur la page profil utilisateur | Dev |

---

## Dépendances critiques

```
0.1, 0.2, 0.4, 0.5 → tout le reste
1.1-1.8 → 2.x et 3.x
3.1-3.2 → 4.x
4.x     → 3.3 → 5.x
```

> Les phases 2 (Bot) et 3 (API) peuvent avancer **en parallèle** une fois le cadrage terminé.
> Les data IA peuvent commencer la Phase 4 dès que le contrat d'interface (0.2) et l'endpoint 3.2 sont prêts.

---

## Planning — 5 séances × 7h

### Séance 6 — Cadrage & Architecture

| Moment | Dev | Data IA |
|--------|-----|---------|
| Matin (3h30) | `[Tous]` Phase 0 complète : contrats d'interface, flow liaison `discord_id` ↔ `user`, validation mots-clés | idem |
| Après-midi (3h30) | Phase 1.1→1.4 : design des nouvelles tables Drizzle | Phase 4.3 : design de la grille `discord_help` |
| **Livrable** | Contrat d'interface finalisé + schéma DB validé | |

### Séance 7 — DB + Setup Bot + Prompt LLM

| Moment | Dev | Data IA |
|--------|-----|---------|
| Matin | Phase 1.5→1.8 : migrations + repositories | Phase 4.1 : prompt système + finalisation grille |
| Après-midi | Phase 2.1→2.2 : setup bot + détection HELP_REQUEST | Phase 4.2 : pipeline LLM v1 |
| **Livrable** | DB migrée, bot qui écoute les messages | Pipeline LLM v1 |

### Séance 8 — Bot complet + Endpoints API

| Moment | Dev | Data IA |
|--------|-----|---------|
| Matin | Phase 2.3→2.6 : rôles helper/beneficiary + délimitation + GRATITUDE | Phase 4.2 suite + tests unitaires |
| Après-midi | Phase 3.1→3.2 : `POST /trigger` + `GET /conversations/:id` | Phase 4.4 : appel endpoint + format de réponse |
| **Livrable** | Bot fonctionnel de bout en bout (déclenchement → envoi API) | |

### Séance 9 — Intégration complète + Tests

| Moment | Dev | Data IA |
|--------|-----|---------|
| Matin | Phase 3.3→3.5 : endpoint résultat + orchestration + sécurité | Phase 4.5 : cas limites + tests d'intégration API |
| Après-midi | Phase 5.1 : scores Discord dans le leaderboard | Fine-tuning prompt |
| `[Tous]` | Tests end-to-end : Discord → LLM → points | |
| **Livrable** | Pipeline complet fonctionnel | |

### Séance 10 — Frontend + Démo

| Moment | Dev | Data IA |
|--------|-----|---------|
| Matin | Phase 5.2→5.4 : profil Discord + page admin + liaison compte | Optimisations + support |
| Après-midi | `[Tous]` Tests finaux, corrections, préparation démo | idem |
| **Livrable** | Application complète + démo | |
