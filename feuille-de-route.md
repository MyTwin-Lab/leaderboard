# Feuille de route — Discord Leaderboard

> **Projet Ydays** · Équipe : 1 Dev · 2 Data IA
> **Objectif** : Récompenser automatiquement les membres d'un serveur Discord qui aident leurs pairs, en détectant les échanges d'entraide et en les évaluant via un LLM.

---

## Contexte & Vision

Le leaderboard existant récompense les contributions techniques (code, modèles, datasets). Ce projet étend ce système à **l'entraide humaine sur Discord** : lorsqu'un membre aide un autre à résoudre un problème et que le bénéficiaire réagit avec un emoji de remerciement, l'orchestrateur LLM évalue la qualité de l'aide et attribue des points au helper.

```
Discord
  └─ Bot détecte réaction emoji 🙏 sur un message
        ├─ helper     = auteur du message réagi
        └─ beneficiary = membre qui a réagi
              └─ POST /api/discord/trigger  ← flux synchrone bout en bout
                    ├─ Connecteur Discord : fetch 20 messages avant le trigger
                    ├─ evaluateDiscordHelp(messages, helper, beneficiary)
                    │     └─ Orchestrateur Data IA : instructions + grille discord_help + messages
                    │           └─ Score (0–100) + justification
                    ├─ discord_evaluations (audit : score, statut, notes LLM)
                    └─ contributions discord_help (points CP + messages en evaluation JSON)
```

---

## Répartition des rôles

| Rôle | Responsabilités |
|------|----------------|
| **Dev** | Schéma DB, migrations, repositories, connecteur Discord, API REST, frontend |
| **Data IA** | Bot Discord, détection emoji reaction, orchestrateur LLM, grille `discord_help` |

---

## Décisions prises en cours de projet

| # | Décision | Justification |
|---|----------|---------------|
| A | Le **bot Discord est développé par les Data IA** | Cohérence avec leur maîtrise du LLM et de la détection NLP |
| B | La table `evaluation_runs` **n'est pas réutilisée** | Retirée par la branche `main` ; table `discord_evaluations` autonome créée à la place |
| C | Les **règles de scoring ne sont pas redéfinies** | `packages/evaluator/reward.ts` existant réutilisé (distribution proportionnelle des CP) |
| D | Les points sont stockés comme une **contribution** `discord_help` | Réutilise le système de leaderboard existant sans modifier le schéma utilisateur |
| E | Les **messages ne sont pas stockés en table dédiée** | Décision référent : transit JSON uniquement — context sauvegardé dans `contributions.evaluation` |
| F | Le **trigger est un emoji reaction** | Signal explicite du bénéficiaire, pas de faux positifs |
| G | **Schéma minimal** : pas de `discord_conversations` ni `discord_triggers` | Une réaction = un enregistrement `discord_evaluations` |
| H | **Flux synchrone** | Décision référent + Alix : l'orchestrateur est appelé directement dans `POST /trigger`, pas de callback LLM |

---

## Schéma DB final

```
discord_accounts       discord_id (PK) · username · user_id FK→users
discord_evaluations    uuid (PK) · channel_id · trigger_message_id · emoji
                       helper_discord_id FK · beneficiary_discord_id FK
                       status · score · notes (JSON: justification + critères LLM)
                       evaluated_at · created_at
```

> Les messages de la conversation ne transitent qu'en RAM — ils sont stockés uniquement dans `contributions.evaluation` (objet contribution final).

---

## Contrat d'interface Dev ↔ Data IA

Fichier : `packages/evaluator/discord/discord.evaluator.ts`

```typescript
// Entrée
{ messages: DiscordMessageItem[], helper, beneficiary }

// Sortie — objet Contribution structuré
{
  title: string,           // "Aide au débogage Python"
  description: string,     // synthèse de l'échange
  tags?: string[],         // ["python", "débogage"]
  evaluation: {
    globalScore: number,   // 0–100
    scores: CriterionScore[],
    justification: string,
  },
  skipped: boolean,
  skip_reason?: string,
}
```

Le stub `evaluateDiscordHelp()` est en place.
La grille `discord_help` est dans `packages/evaluator/grids/discord_help.grid.ts`.
Les Data IA remplacent le stub par l'appel réel à leur orchestrateur (tâche 4.2).

---

## Avancement — Séance 6 (après réunion référent)

```
Phase 1 — Base de données    ██████████░  90%  (1.7 migration restante)
Phase 2 — Bot Discord        ██████░░░░░  60%  (2.3→2.4 restants)
Phase 3 — API                █████████░░  90%  (3.5 sécurité restante)
Phase 4 — LLM                ░░░░░░░░░░░   0%  (Data IA — à démarrer)
Phase 5 — Frontend           ░░░░░░░░░░░   0%  (à démarrer séance 7)
```

---

## Phase 0 — Cadrage (Toute l'équipe)

- [x] **0.1** — Format de payload bot → API : `{ channel_id, trigger_message_id, emoji, helper, beneficiary }` *(Tous)*
- [x] **0.2** — Contrat d'interface API ↔ orchestrateur LLM : `DiscordEvaluationInput` / `DiscordEvaluationOutput` dans `packages/evaluator/discord/discord.evaluator.ts` *(Tous)*
- [ ] **0.4** — Flow de **liaison** `discord_id` ↔ `user` en DB *(Dev + PO)*
- [x] **0.5** — ~~Mots-clés~~ → **Emoji trigger** choisi avec l'équipe *(Tous)*

---

## Phase 1 — Base de données (Dev)

- [x] **1.1** — Table **`discord_accounts`** (`discord_id`, `username`, `user_id FK`) *(Dev)*
- [x] ~~**1.2** `discord_conversations`~~ — supprimée (décision G)
- [x] ~~**1.3** `discord_messages`~~ — supprimée (décision E)
- [x] ~~**1.4** `discord_triggers`~~ — supprimée (décision G)
- [x] **1.5** — Vérification `evaluation_runs` / `evaluation_grids` → décision B *(Dev)*
- [x] **1.6** — Table **`discord_evaluations`** enrichie (`channel_id`, `trigger_message_id`, `emoji`, participants FK, `status`, `score`, `notes`) *(Dev)*
- [ ] **1.7** — **Migration Drizzle** *(Dev)*
- [x] **1.8** — Repositories : `discordAccount`, `discordEvaluation` *(Dev)*

---

## Phase 2 — Bot Discord (Data IA)

- [x] **2.1** — Setup bot (token, permissions `GUILD_MESSAGE_REACTIONS` + `MESSAGE_CONTENT`) *(Data IA)*
- [x] **2.2** — Écouter **`MESSAGE_REACTION_ADD`**, filtrer sur l'emoji trigger *(Data IA)*
- [ ] **2.3** — Identifier : **helper** = auteur du message · **beneficiary** = qui a réagi *(Data IA)*
- [ ] **2.4** — Appeler `POST /api/discord/trigger` *(Data IA)*
- [x] **2.5** — Cas limites : bot exclu, double reaction, message du bot *(Data IA)*

---

## Phase 3 — API (Dev)

- [x] **3.1** — `POST /api/discord/trigger` — flux synchrone complet : upsert comptes → fetch messages → orchestrateur → audit → contribution *(Dev)*
- [x] **3.2** — ~~`GET /conversations/:id`~~ → **`GET /evaluations/:id`** — visualisation admin *(Dev)*
- [x] ~~**3.3** `POST /evaluation-result`~~ — supprimé (flux synchrone, pas de callback) *(Dev)*
- [x] **3.4** — `DiscordService.awardPoints()` → contribution `discord_help` avec messages en JSON *(Dev)*
- [x] **3.6** — `DiscordConnector` — fetch `GET /channels/{id}/messages?before={id}&limit=20` *(Dev)*
- [ ] **3.5** — Sécuriser l'endpoint trigger (token partagé bot ↔ API) *(Dev)*

---

## Phase 4 — Orchestrateur LLM (Data IA)

- [ ] **4.1** — Prompt système d'évaluation *(Data IA)*
- [ ] **4.2** — Implémenter **`evaluateDiscordHelp()`** dans `packages/evaluator/discord/discord.evaluator.ts` — remplacer le stub *(Data IA)* · call avec Alix séance 7-8
- [x] **4.3** — Grille **`discord_help`** dans `packages/evaluator/grids/discord_help.grid.ts` *(Dev — base en place, à affiner par Data IA)*
- [ ] **4.5** — Cas d'ambiguïté : aide insuffisante, conversation trop courte → `skipped: true` *(Data IA)*

---

## Phase 5 — Frontend (Dev)

- [ ] **5.1** — Scores Discord dans le **leaderboard** *(Dev)*
- [ ] **5.2** — Page **profil** : section "Aide Discord" *(Dev)*
- [ ] **5.3** — Page **admin** : liste des `discord_evaluations` (trigger, score, statut, participants) via `GET /evaluations/:id` *(Dev)*
- [ ] **5.4** — Flow de **liaison compte Discord** sur le profil *(Dev)*

---

## Dépendances

```
0.1, 0.2, 0.4    ──→ tout le reste
1.1 – 1.8        ──→ 2.x  et  3.x
3.1 – 3.6        ──→ 4.x (stub à brancher)
4.2 – 4.3        ──→ tests end-to-end  ──→ 5.x
```

---

## Variables d'environnement

| Variable | Usage |
|----------|-------|
| `DISCORD_BOT_TOKEN` | Connecteur Discord (fetch messages) + bot Data IA |
| `DATABASE_URL` | PostgreSQL |

---

## Planning — séances restantes

### Séance 6 *(terminée)*

| Moment | Dev ✅ | Data IA ✅ |
|--------|--------|------------|
| Matin | ~~1.1→1.6 : tables Discord · 1.8 : repositories · 3.1→3.4 : API · 3.6 : connecteur Discord~~ | — |
| Après-midi | ~~Réunion référent : refactor architecture (décisions E→H) · flux synchrone · contrat interface · grille `discord_help` (4.3 base)~~ | ~~2.1 : setup bot · 2.2 : détection emoji `MESSAGE_REACTION_ADD` · 2.5 : cas limites~~ |
| **Livrable** | ~~API complète · connecteur · stub `evaluateDiscordHelp()` · grille~~ ✅ | ~~Bot configuré · détection emoji opérationnelle~~ ✅ |

### Séance 7 — Migration + Bot + Orchestrateur

| Moment | Dev | Data IA |
|--------|-----|---------|
| Matin | 1.7 : migration Drizzle · 3.5 : sécurisation endpoint | 2.3 : identification helper/beneficiary · 2.4 : appel `POST /trigger` |
| Après-midi | 5.1 : scores Discord dans le leaderboard | 4.1 : prompt système · 4.3 : affiner grille `discord_help` |
| **Livrable** | DB migrée · endpoint sécurisé | Bot opérationnel bout en bout · prompt défini |

### Séance 8 — Bot complet + Pipeline LLM

| Moment | Dev | Data IA |
|--------|-----|---------|
| Matin | 5.2→5.3 : profil + admin | 2.5 : cas limites · 4.2 : implémenter `evaluateDiscordHelp()` |
| Après-midi | Support Data IA | Tests du stub → orchestrateur réel |
| **Livrable** | Frontend 80% | Pipeline LLM fonctionnel bout en bout |

### Séance 9 — Intégration & Tests

| Moment | Dev | Data IA |
|--------|-----|---------|
| Matin | 5.4 : liaison compte Discord | 4.5 : cas d'ambiguïté |
| `[Tous]` | Tests end-to-end : emoji → connecteur → orchestrateur → points → leaderboard | |
| **Livrable** | Pipeline complet fonctionnel | |

### Séance 10 — Finition & Marge

| Dev | Data IA |
|-----|---------|
| Bugs · polish UI · slides | Fine-tuning · slides |

> Marge de sécurité — la séance 10 doit livrer quelque chose de stable pour l'oral.

### Séance 11 — Oral

| Démo live | emoji → connecteur → orchestrateur → points → leaderboard |
|-----------|-----------------------------------------------------------|
| Présentation | Contexte · décisions A→H · répartition des rôles |
| Q&A | Retours jury |
