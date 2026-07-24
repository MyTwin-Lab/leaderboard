# Challenge 011 – Contribution Signals (Slack)

## Résumé

Récompenser la collaboration qui se passe **en dehors du code** : les échanges dans les canaux de discussion. Un challenge peut définir des **signaux de contribution** (ex. « Idée proposée », « Entraide », « Review ») avec une récompense en CP, et être relié à un **canal Slack**. Un agent LLM analyse quotidiennement les nouveaux messages du canal et attribue automatiquement les signaux détectés aux participants, sous forme de contributions.

## Problème

- Le leaderboard ne valorise aujourd'hui que les contributions techniques (commits, soumissions ML, meetings analysés).
- L'entraide, les idées, les reviews informelles dans Slack sont invisibles alors qu'elles portent une grande partie de la collaboration.
- Les managers n'ont aucun outil pour encourager et mesurer la vie d'un challenge dans les canaux de discussion.

## Valeur attendue

- Cycle de vie du challenge enrichi : la discussion quotidienne alimente le leaderboard sans action manuelle.
- Incitation à la collaboration : chaque signal est défini à l'écrit par le manager, avec une récompense CP fixe et transparente.
- Attribution auditable : chaque CP attribué est relié à un message, un signal et une justification du LLM (ledger `reward_entries`).
- Affichage dédié dans le profil : un bloc « Discussion » en chips par signal (×count · CP), distinct des contributions classiques.

## Contraintes

- Slack d'abord ; l'architecture (connecteurs, signaux génériques) doit permettre d'autres canaux plus tard.
- Connexion Slack v1 = bot token collé par l'admin (pattern Kaggle), chiffré AES-256-GCM dans `app_settings`. Pas d'OAuth.
- Mapping auteur Slack → utilisateur leaderboard par **email** (déterministe, résolu avant l'appel LLM). Le LLM ne fait pas de matching d'identité.
- Les CP des signaux sont **hors pool** du challenge (ne consomment ni le pool distribué à la clôture des challenges code, ni le `remainingPool` des challenges ML).
- Réutiliser l'existant : ledger `reward_entries` + `createManyAndSyncRewards`, pattern agent OpenAI de `sync-meeting-agent`, pattern cron `check-meetings`, pattern credentials Kaggle.
- V1 : messages du canal uniquement (pas les réponses en thread).
