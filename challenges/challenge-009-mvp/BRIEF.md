# Challenge 009 – MVP Public Release

## Résumé

Rendre le leaderboard **utilisable par n'importe quel membre du MyTwin Lab** de manière simple et intuitive. Ce challenge regroupe les derniers ajustements nécessaires avant une mise en production ouverte à tous.

## Problème

- L'authentification repose sur un couple `github_username` / `password`, peu pratique et source de friction.
- Les pages clés (`/challenges/[id]`, `/tasks/[id]`, `/sync-meetings/[id]`) manquent de polish et de cohérence visuelle.
- Le profil utilisateur n'est pas éditable (pas de modification du nom/prénom).
- Les nouveaux utilisateurs ont du mal à comprendre le parcours contributeur.


## Valeur attendue

- Onboarding fluide : un clic Google pour se connecter, le drawer guide la suite.
- Parcours contributeur complet et intuitif : se connecter → découvrir → s'assigner → évaluer → voir son score.
- Design cohérent et professionnel sur les pages principales.
- Profil personnalisable.

## Contraintes

- Certaines briques existent déjà dans la codebase (Google OAuth pour liaison de compte, évaluation de tâche). Il s'agit de les adapter/compléter, pas de repartir de zéro.