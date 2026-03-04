# Feuille de route — Discord Leaderboard

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
- [x] **1.5** — Vérifier la réutilisation des tables **`evaluation_runs`** et **`evaluation_grids`** → décision : `evaluation_grids` réutilisable, `evaluation_runs` retirée par main *(Dev)*
- [ ] **1.6** — Ajouter la table **`evaluation_run_discord_conversations`** liée à `evaluation_runs` et `discord_conversations` *(Dev)*
- [ ] **1.7** — Générer la **migration Drizzle** et la documenter *(Dev)*
- [ ] **1.8** — Écrire les **repositories** pour chaque nouvelle table (pattern existant dans `packages/database-service/repositories/`) *(Dev)*

---

## Phase 2 — Bot Discord (Data IA)

> Bot développé par les Data IA, qui gèrent à la fois le LLM et la détection Discord

- [ ] **2.1** — Setup du bot Discord (token, permissions, canaux écoutés) *(Data IA)*
- [ ] **2.2** — Implémenter la **détection HELP_REQUEST** → appel API `POST /discord/trigger` *(Data IA)*
- [ ] **2.3** — Implémenter la **logique d'identification des rôles** : qui est le helper, qui est le beneficiary *(Data IA)*
- [ ] **2.4** — Implémenter la **délimitation de l'historique** : `start_message_id` → `end_message_id` *(Data IA)*
- [ ] **2.5** — Implémenter la **détection GRATITUDE** → clore la conversation + envoyer à l'API pour évaluation *(Data IA)*
- [ ] **2.6** — Gérer les **cas limites** : conversation sans réponse, plusieurs helpers, timeout *(Data IA)*

---

## Phase 3 — API (Dev)

> Nouveaux endpoints dans `apps/leaderboard-client/src/app/api/`

- [ ] **3.1** — `POST /api/discord/trigger` — reçoit un trigger détecté par le bot et l'enregistre *(Dev)*
- [ ] **3.2** — `GET /api/discord/conversations/:id` — expose la conversation formatée pour le LLM *(Dev)*
- [ ] **3.3** — `POST /api/discord/evaluation-result` — reçoit le score du LLM et l'enregistre *(Dev)*
- [ ] **3.4** — Créer le **service d'orchestration** : trigger reçu → appel LLM → score → attribution points *(Dev)*
- [ ] **3.5** — Sécuriser les endpoints bot + LLM (token partagé ou IP whitelist) *(Dev)*

---

## Phase 4 — Évaluation LLM (Data IA)

> S'appuie sur le contrat défini en Phase 0 et les endpoints Phase 3

- [ ] **4.1** — Définir et documenter le **prompt système** utilisé pour évaluer une conversation *(Data IA)*
- [ ] **4.2** — Implémenter le **pipeline d'évaluation** : réception de la conversation → analyse → score structuré *(Data IA)*
- [ ] **4.3** — Ajouter une grille **`discord_help`** dans `packages/evaluator/grids/` en suivant le pattern existant (`code`/`model`/`dataset`) *(Data IA)*
- [ ] **4.4** — Implémenter l'**appel au endpoint** `POST /api/discord/evaluation-result` avec le score *(Data IA)*
- [ ] **4.5** — Gérer les **cas d'ambiguïté** : aide insuffisante, conversation trop courte, hors sujet *(Data IA)*

---

## Phase 5 — Frontend (Dev)

- [ ] **5.1** — Intégrer les scores Discord dans le **leaderboard existant** *(Dev)*
- [ ] **5.2** — Page **profil** : section "Aide Discord" avec historique des contributions *(Dev)*
- [ ] **5.3** — Page **admin** : visualisation des évaluations Discord (conversation, trigger, score, statut) *(Dev)*
- [ ] **5.4** — Flow de **liaison compte Discord** sur la page profil utilisateur *(Dev)*

---

## Dépendances critiques

```
0.1, 0.2, 0.4, 0.5 → tout le reste
1.1-1.8            → 2.x et 3.x
3.1-3.2            → 4.x
4.x                → 3.3 → 5.x
```

> Les phases 2 (Bot — Data IA) et 3 (API — Dev) peuvent avancer **en parallèle** une fois le cadrage terminé.
> Les data IA peuvent commencer la Phase 4 dès que le contrat d'interface (0.2) et l'endpoint 3.2 sont prêts.

---

## Planning — 5 séances × 7h

### Séance 6 — Cadrage & Architecture

| Moment | Dev | Data IA |
|--------|-----|---------|
| Matin (3h30) | `[Tous]` Phase 0 : contrats d'interface, flow liaison `discord_id` ↔ `user`, validation mots-clés | idem |
| Après-midi (3h30) | Phase 1.1→1.4 : tables Drizzle ✅ | Phase 4.3 : design de la grille `discord_help` |
| **Livrable** | Contrat d'interface finalisé + schéma DB validé | |

### Séance 7 — DB + Setup Bot + Prompt LLM

| Moment | Dev | Data IA |
|--------|-----|---------|
| Matin | Phase 1.5 ✅ + 1.6→1.8 : migration + repositories | Phase 4.1 : prompt système + finalisation grille |
| Après-midi | Phase 3.1→3.2 : endpoints API | Phase 2.1→2.2 : setup bot + détection HELP_REQUEST |
| **Livrable** | DB migrée + endpoints de base | Bot qui écoute + LLM v1 |

### Séance 8 — Bot complet + API complète

| Moment | Dev | Data IA |
|--------|-----|---------|
| Matin | Phase 3.3→3.5 : orchestration + sécurité | Phase 2.3→2.6 : rôles + délimitation + GRATITUDE |
| Après-midi | Phase 4.2 : pipeline LLM | Phase 4.4 : appel endpoint + format de réponse |
| **Livrable** | API complète | Bot fonctionnel bout en bout |

### Séance 9 — Intégration complète + Tests

| Moment | Dev | Data IA |
|--------|-----|---------|
| Matin | Phase 5.1 : scores Discord dans le leaderboard | Phase 4.5 : cas limites + tests d'intégration |
| `[Tous]` | Tests end-to-end : Discord → LLM → points | |
| **Livrable** | Pipeline complet fonctionnel | |

### Séance 10 — Frontend + Démo

| Moment | Dev | Data IA |
|--------|-----|---------|
| Matin | Phase 5.2→5.4 : profil + admin + liaison compte | Optimisations LLM + support |
| Après-midi | `[Tous]` Tests finaux, corrections, préparation démo | idem |
| **Livrable** | Application complète + démo | |
