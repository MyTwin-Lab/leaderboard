# Rapport Séance 6 — Discord Leaderboard (Ydays)

> **Date :** 25 mars 2026
> **Équipe :** 1 Dev · 2 Data IA
> **Référent :** Alix

---

## Contexte du projet

Le projet s'inscrit dans l'extension d'un leaderboard existant qui récompense les contributions techniques (code, modèles, datasets). L'objectif est d'y ajouter la dimension **entraide humaine sur Discord** : quand un membre aide un autre et reçoit un emoji de remerciement, un orchestrateur LLM évalue la qualité de l'aide et attribue des points au helper.

---

## Changement de cap : séance 5 → séance 6

Le projet a subi un **pivot important** entre les deux séances, en concertation avec le référent et l'équipe externe (Data IA).

### Tâches initiales (avant séance 6)

| Équipe | Tâches prévues |
|--------|----------------|
| **Dev** | Liaison des comptes utilisateurs via **OAuth 2.0** (GitHub, Hugging Face, Slack) aux profils du leaderboard |
| **Data IA** | Développement d'un **LLM** et d'un **chatbot IA** pour l'évaluation des contributions |

Ces tâches impliquaient notamment de lier les identités externes (GitHub, Hugging Face, Slack) à un compte leaderboard central, via un flow d'autorisation OAuth 2.0 classique.

### Pourquoi le pivot ?

Le projet s'inscrit dans un travail conjoint avec l'**équipe principale du leaderboard**, qui développe le projet à temps plein. Entre la séance 5 et la séance 6, un décalage est apparu : une partie des tâches initialement attribuées à notre équipe (liaison OAuth 2.0, LLM, chatbot) avait déjà été prise en charge par l'équipe principale au fil de leur avancement.

Ce contexte a conduit, en concertation avec le référent, à **revoir la répartition et le périmètre des tâches** :

- Les tâches OAuth 2.0 (liaison GitHub, Hugging Face, Slack) ont été **retirées de notre scope** — déjà couvertes ou trop couplées au travail de l'équipe principale
- Le focus a été recentré sur **Discord uniquement**, car ce périmètre permet à notre équipe de travailler de façon **indépendante**, en parallèle, sans dépendre du rythme de l'équipe principale

### Tâches révisées (séance 6 et au-delà)

| Équipe | Nouvelles tâches |
|--------|-----------------|
| **Dev** | Schéma DB Discord, API REST synchrone, connecteur Discord, stub LLM |
| **Data IA** | Bot Discord (détection emoji reaction), orchestrateur LLM, grille d'évaluation `discord_help` |

---

## Ce qui a été fait en séance 6

### Dev

**Matin — Base de données & API**

- Table `discord_accounts` (`discord_id`, `username`, `user_id FK` → users)
- Table `discord_evaluations` enrichie : `channel_id`, `trigger_message_id`, `emoji`, participants FK, `status`, `score`, `notes` (JSON LLM)
- Décision : suppression des tables `discord_conversations`, `discord_messages`, `discord_triggers` (schéma minimal)
- Repositories : `discordAccount`, `discordEvaluation`
- `POST /api/discord/trigger` — flux synchrone complet : upsert comptes → fetch messages → orchestrateur → audit → contribution
- `GET /evaluations/:id` — endpoint d'administration
- `DiscordService.awardPoints()` — contribution `discord_help` avec messages en JSON
- `DiscordConnector` — fetch des 20 messages avant le trigger via l'API Discord

**Après-midi — Réunion référent + refactor**

- Adoption du **flux synchrone** (l'orchestrateur est appelé directement dans `POST /trigger`, pas de callback)
- Définition du **contrat d'interface** Dev ↔ Data IA dans `packages/evaluator/discord/discord.evaluator.ts`
- Stub `evaluateDiscordHelp()` en place (à remplacer par les Data IA)
- Grille `discord_help` posée dans `packages/evaluator/grids/discord_help.grid.ts`
- Formalisation des décisions d'architecture (A → H)

### Data IA

**Après-midi**

- Setup du bot Discord (token, permissions `GUILD_MESSAGE_REACTIONS` + `MESSAGE_CONTENT`)
- Écoute de l'événement `MESSAGE_REACTION_ADD`, filtré sur l'emoji trigger
- Gestion des cas limites : bot exclu, double reaction, message du bot

---

## État d'avancement après séance 6

```
Phase 1 — Base de données    ██████████░  90%  (migration Drizzle restante)
Phase 2 — Bot Discord        ██████░░░░░  60%  (identification helper/beneficiary + appel API restants)
Phase 3 — API                █████████░░  90%  (sécurisation endpoint restante)
Phase 4 — LLM                ░░░░░░░░░░░   0%  (Data IA — démarre séance 7)
Phase 5 — Frontend           ░░░░░░░░░░░   0%  (démarre séance 7)
```

---

## Pour la séance 7

| Équipe | Tâches |
|--------|--------|
| **Dev** | Migration Drizzle · sécurisation endpoint trigger · scores Discord dans le leaderboard (début frontend) |
| **Data IA** | Identification helper/beneficiary · appel `POST /trigger` · prompt système LLM · affinage grille |
