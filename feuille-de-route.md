# Feuille de route — Discord Leaderboard

> **Projet Ydays** · Équipe : 1 Dev · 2 Data IA
> **Objectif** : Récompenser automatiquement les membres d'un serveur Discord qui aident leurs pairs, en détectant les échanges d'entraide et en les évaluant via un LLM.

---

## Contexte & Vision

Le leaderboard existant récompense les contributions techniques (code, modèles, datasets). Ce projet étend ce système à **l'entraide humaine sur Discord** : lorsqu'un membre aide un autre à résoudre un problème et reçoit un remerciement, le LLM évalue la qualité de l'aide et attribue des points au helper.

```
Discord
  └─ Bot détecte "besoin d'aide"     → ouvre une CONVERSATION
  └─ Bot détecte "merci / thank you" → clôt la conversation
                                      → API notifiée
                                          └─ LLM évalue la conversation
                                              └─ Score → Points → Leaderboard
```

---

## Répartition des rôles

| Rôle | Responsabilités |
|------|----------------|
| **Dev** | Schéma DB, migrations, repositories, API REST, frontend |
| **Data IA** | Bot Discord, détection de mots-clés, pipeline LLM, grille d'évaluation |

---

## Décisions prises en cours de projet

| # | Décision | Justification |
|---|----------|---------------|
| A | Le **bot Discord est développé par les Data IA** | Cohérence avec leur maîtrise du LLM et de la détection NLP |
| B | La table `evaluation_runs` **n'est pas réutilisée** | Retirée par la branche `main` lors de la synchronisation ; table `discord_evaluations` autonome créée à la place |
| C | Les **règles de scoring ne sont pas redéfinies** | `packages/evaluator/reward.ts` existant est réutilisé (distribution proportionnelle des CP) |
| D | Les points sont stockés comme une **contribution** `discord_help` | Permet de réutiliser le système de leaderboard existant sans modifier le schéma utilisateur |

---

## Avancement — Séance 6

```
Phase 1 — Base de données    ██████████░  90%  (1.7 migration restante)
Phase 2 — Bot Discord        ░░░░░░░░░░░   0%  (Data IA — à démarrer)
Phase 3 — API                ████████░░░  80%  (3.5 sécurité restante)
Phase 4 — LLM                ░░░░░░░░░░░   0%  (Data IA — à démarrer)
Phase 5 — Frontend           ░░░░░░░░░░░   0%  (à démarrer séance 7)
```

---

## Phase 0 — Cadrage (Toute l'équipe)

- [ ] **0.1** — Définir le **format de payload** échangé entre le bot Discord et l'API *(Tous)*
- [ ] **0.2** — Définir le **contrat d'interface** API ↔ LLM : ce que les data IA reçoivent (conversation formatée) et ce qu'ils retournent (score structuré) *(Tous)*
- [ ] **0.4** — Définir le **flow de liaison** `discord_id` ↔ `user` existant en DB (compte existant ou création à la volée ?) *(Dev + PO)*
- [ ] **0.5** — Valider la **liste de mots-clés** GRATITUDE et HELP_REQUEST (FR + EN) avec l'équipe *(Tous)*

---

## Phase 1 — Base de données (Dev)

> S'appuie sur le schéma Drizzle existant dans `packages/database-service/db/drizzle.ts`

- [x] **1.1** — Ajouter la table **`discord_accounts`** (`discord_id`, `username`, `user_id FK`) *(Dev)*
- [x] **1.2** — Ajouter la table **`discord_conversations`** (`conversation_id`, `channel_id`, `helper_discord_id FK`, `beneficiary_discord_id FK`, `start_message_id`, `end_message_id`, `started_at`) *(Dev)*
- [x] **1.3** — Ajouter la table **`discord_messages`** (`message_id`, `discord_message_id`, `conversation_id FK`, `author_discord_id FK`, `content`, `sent_at`) *(Dev)*
- [x] **1.4** — Ajouter la table **`discord_triggers`** (`trigger_id`, `message_id FK`, `trigger_type`, `keyword_detected`, `language`) *(Dev)*
- [x] **1.5** — Vérifier la réutilisation des tables `evaluation_runs` et `evaluation_grids` → décision B *(Dev)*
- [x] **1.6** — Ajouter la table **`discord_evaluations`** (`conversation_id FK`, `status`, `score`, `notes`, `evaluated_at`) *(Dev)*
- [ ] **1.7** — Générer la **migration Drizzle** et la documenter *(Dev)*
- [x] **1.8** — Écrire les **repositories** (`discordAccount`, `discordConversation`, `discordMessage`, `discordTrigger`, `discordEvaluation`) *(Dev)*

---

## Phase 2 — Bot Discord (Data IA)

> Bot développé par les Data IA — décision A

- [ ] **2.1** — Setup du bot Discord (token, permissions, canaux écoutés) *(Data IA)*
- [ ] **2.2** — Implémenter la **détection HELP_REQUEST** → appel API `POST /discord/trigger` *(Data IA)*
- [ ] **2.3** — Implémenter la **logique d'identification des rôles** : helper / beneficiary *(Data IA)*
- [ ] **2.4** — Implémenter la **délimitation de l'historique** : `start_message_id` → `end_message_id` *(Data IA)*
- [ ] **2.5** — Implémenter la **détection GRATITUDE** → clore la conversation + notifier l'API *(Data IA)*
- [ ] **2.6** — Gérer les **cas limites** : pas de réponse, plusieurs helpers, timeout *(Data IA)*

---

## Phase 3 — API (Dev)

> Endpoints dans `apps/leaderboard-client/src/app/api/discord/`

- [x] **3.1** — `POST /api/discord/trigger` — reçoit un trigger du bot et orchestre la création en DB *(Dev)*
- [x] **3.2** — `GET /api/discord/conversations/:id` — expose la conversation formatée pour le LLM *(Dev)*
- [x] **3.3** — `POST /api/discord/evaluation-result` — reçoit le score du LLM et l'enregistre *(Dev)*
- [x] **3.4** — `DiscordService` : GRATITUDE → `initEvaluation()` → LLM évalue → `awardPoints()` → contribution `discord_help` — décision D *(Dev)*
- [ ] **3.5** — Sécuriser les endpoints bot + LLM (token partagé ou IP whitelist) *(Dev)*

---

## Phase 4 — Évaluation LLM (Data IA)

> S'appuie sur le contrat défini en Phase 0 et les endpoints Phase 3

- [ ] **4.1** — Définir et documenter le **prompt système** d'évaluation de conversation *(Data IA)*
- [ ] **4.2** — Implémenter le **pipeline d'évaluation** : conversation → analyse → score structuré *(Data IA)*
- [ ] **4.3** — Ajouter la grille **`discord_help`** dans `packages/evaluator/grids/` (pattern existant `code`/`model`/`dataset`) *(Data IA)*
- [ ] **4.4** — Implémenter l'appel à `POST /api/discord/evaluation-result` avec le score *(Data IA)*
- [ ] **4.5** — Gérer les **cas d'ambiguïté** : aide insuffisante, conversation trop courte, hors sujet *(Data IA)*

---

## Phase 5 — Frontend (Dev)

- [ ] **5.1** — Intégrer les scores Discord dans le **leaderboard existant** *(Dev)*
- [ ] **5.2** — Page **profil** : section "Aide Discord" avec historique des contributions *(Dev)*
- [ ] **5.3** — Page **admin** : visualisation des évaluations Discord (conversation, trigger, score, statut) *(Dev)*
- [ ] **5.4** — Flow de **liaison compte Discord** sur la page profil utilisateur *(Dev)*

---

## Dépendances

```
0.1, 0.2, 0.4, 0.5 ──→ tout le reste
1.1 – 1.8          ──→ 2.x  et  3.x
3.1 – 3.2          ──→ 4.x
4.x                ──→ 3.3  ──→ 5.x
```

> Les phases 2 (Bot — Data IA) et 3 (API — Dev) avancent **en parallèle**.
> Les Data IA peuvent attaquer la Phase 4 dès que 0.2 et 3.2 sont prêts.

---

## Planning — 5 séances × 7h

### Séance 6 — Cadrage & Architecture *(en cours)*

| Moment | Dev | Data IA |
|--------|-----|---------|
| ~~Matin~~ ✅ | ~~Tables 1.1→1.6 · Repositories 1.8 · API 3.1→3.4~~ | — |
| Après-midi | `[Tous]` Phase 0 : contrats, liaison `discord_id` ↔ `user`, mots-clés | idem |
| Fin de séance | Migration Drizzle 1.7 | Setup bot Discord 2.1 |
| **Livrable** | DB migrée · contrats définis | Bot configuré |

### Séance 7 — Sécurité + Bot + LLM

| Moment | Dev | Data IA |
|--------|-----|---------|
| Matin | 3.5 : sécurisation endpoints | 2.2→2.3 : HELP_REQUEST + identification des rôles |
| Après-midi | 5.1 : scores Discord dans le leaderboard | 4.1 : prompt système · 4.3 : grille `discord_help` |
| **Livrable** | Endpoints sécurisés · leaderboard à jour | Bot opérationnel · prompt défini |

### Séance 8 — Bot complet + Pipeline LLM

| Moment | Dev | Data IA |
|--------|-----|---------|
| Matin | 5.2→5.3 : page profil + page admin | 2.4→2.6 : délimitation · GRATITUDE · cas limites |
| Après-midi | Support Data IA + review API | 4.2 : pipeline LLM v1 · 4.4 : appel endpoint |
| **Livrable** | Frontend 80% | Bot bout en bout · LLM v1 |

### Séance 9 — Intégration & Tests

| Moment | Dev | Data IA |
|--------|-----|---------|
| Matin | 5.4 : liaison compte Discord | 4.5 : cas d'ambiguïté · tests d'intégration |
| `[Tous]` | Tests end-to-end : Discord → LLM → points → leaderboard | |
| **Livrable** | Pipeline complet fonctionnel | |

### Séance 10 — Finition & Marge

| Moment | Dev | Data IA |
|--------|-----|---------|
| Matin | Corrections bugs · polish UI | Fine-tuning LLM |
| Après-midi | `[Tous]` Tests finaux · préparation des supports de présentation | idem |
| **Livrable** | Application stable · slides prêts | |

> La fin de la séance 10 sert de **marge de sécurité** : traiter les imprévus, consolider les derniers bugs, finaliser la démo.

### Séance 11 — Oral

> Présentation du projet devant jury. Aucun développement prévu — la séance 10 doit livrer quelque chose de stable.

| Moment | Contenu |
|--------|---------|
| Démo live | Pipeline Discord → LLM → points → leaderboard |
| Présentation | Contexte · décisions techniques · répartition des rôles · difficultés rencontrées |
| Q&A | Retours jury |
