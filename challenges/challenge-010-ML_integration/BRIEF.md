# Challenge 010 – ML Integration

## Résumé

Étendre le système de contribution et d'évaluation du leaderboard au-delà du code GitHub pour supporter les contributions **Machine Learning** publiées sur Kaggle (datasets et modèles), guider les contributeurs avec un composant contextuel, et rendre l'interface **white-labelisable** via un système de thème paramétrable.

## Problème

- Le leaderboard ne reconnaissait que les contributions de type **code** (repos GitHub).
- Les contributeurs ML (data scientists, chercheurs) publient leur travail sur **Kaggle**, pas sur GitHub : datasets publics, modèles entraînés.
- Il n'existait aucun moyen de tracer, évaluer ou valoriser ces contributions dans le leaderboard.
- Le pipeline d'évaluation était monolithique et fortement couplé à GitHub, rendant l'ajout d'une nouvelle source externe difficile.
- Sur la page task, rien n'indiquait au contributeur comment structurer ou soumettre sa contribution selon le type de workspace.
- L'interface était visuellement figée : couleurs, nom de l'app et liens de navigation étaient hardcodés, rendant impossible tout déploiement white-label pour un autre Lab.

## Valeur attendue

- Un contributeur ML peut lier un dataset ou modèle Kaggle à une tâche et être évalué automatiquement.
- Le système est extensible à de nouvelles sources externes (HuggingFace, etc.) sans modifier le cœur du pipeline.
- Un composant `HowToContribute` guide chaque contributeur avec les instructions adaptées à son type de workspace (GitHub, dataset Kaggle, modèle Kaggle).
- Le leaderboard peut être déployé sous une autre identité visuelle en changeant un seul fichier de configuration de thème, sans toucher au code.

## Contraintes

- Le `ConnectorRegistry` existant devait être refactoré pour respecter l'OCP (ajout d'un connecteur = enregistrement, pas modification du fichier).
- L'API Kaggle est authentifiée par `KAGGLE_USERNAME` / `KAGGLE_KEY` ; ces credentials sont globaux au Lab (pas par utilisateur).
- Pour les tâches concurrentes, chaque contributeur soumet son propre lien Kaggle (dataset ou modèle) via l'interface.
- Le pipeline d'évaluation devait être décomposé en étapes distinctes (SRP) avant d'y brancher Kaggle.
- Le système de thème doit fonctionner à la fois au build (Tailwind tokens statiques via CSS vars) et au runtime (injection dans le layout), avec un fallback sur le thème MyTwin Lab par défaut.
