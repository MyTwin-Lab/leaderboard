## **Roadmap de la mise à jour pour l'expérience contributeur**

### Phase 0 – Préparation technique (Backend)

- **0.1** Créer les tables `tasks` et `task_assignees` en base de données.
- **0.2** Ajouter le champ `created_at` à la table [contributions](cci:7://file:///c:/Users/alixc/Desktop/TEST/leaderboard/apps/leaderboard-client/src/app/api/contributions:0:0-0:0).
- **0.3** Créer les entités, schémas et repositories pour le système de tâches.
- **0.4** Modifier l'agent `identify` de l'Evaluator pour recevoir les tâches du challenge au lieu de la roadmap.

### Phase 1 – Design & contenus publics

- **1.1** Cartographier les pages existantes et définir le design pour les nouvelles vues publiques.
- **1.2** Produire les maquettes haute fidélité des pages About, Challenges, Profil personnelo et Activité publique.
- **1.4** Designer la modale de détail challenge avec système de tâches et assignation.

### Phase 2 – Pages publiques & navigation

- **2.1** Créer la page [/about](cci:7://file:///c:/Users/alixc/Desktop/TEST/leaderboard/apps/leaderboard-client/src/app/about:0:0-0:0) avec contenu hardcodé en markdown.
- **2.2** Créer la page [/challenges](cci:7://file:///c:/Users/alixc/Desktop/TEST/leaderboard/apps/leaderboard-client/src/app/challenges:0:0-0:0) avec liste des challenges et métriques.
- **2.3** Uniformiser la navigation publique.
- **2.4** Créer le hook de gestion des rôles pour les guards UI.

### Phase 3 – CTA et flux d'engagement

- **3.1** Ajouter le bouton « Rejoindre un challenge » contextuel.
- **3.2** Définir le flux post-CTA (modale, redirection).
- **3.3** Implémenter la modale de détail challenge avec affichage des tâches.
- **3.4** Créer les endpoints API pour les tâches.

### Phase 4 – Authentification contributeurs & badge global

- **4.1** Vérifier le support du rôle "contributeur" dans l'auth existante.
- **4.2** Mettre à jour le badge utilisateur pour afficher le lien admin si applicable.
- **4.3** Implémenter les guards UI selon le rôle connecté.

### Phase 5 – Page profil contributeur

- **5.1** Lister les challenges en cours/terminés pour chaque contributeur.
- **5.2** Ajouter un champ "expertise" éditable.
- **5.3** Afficher l'historique d'activité (Les tâches en cours) et la possibilité de les faire évaluer.
- **5.4** Implémenter le bouton "Évaluer" sur chaque tâche assignée et le flux d'évaluation via le package `@leaderboard/evaluator`.

### Phase 6 – Page admin challenges (système de tâches)

- **6.1** Modifier la modale de création/édition de challenge pour intégrer les tâches.
- **6.2** Permettre l'ajout de tâches avec type, titre et description.
- **6.3** Créer l'endpoint de création de tâches.
- **6.4** Afficher et gérer les tâches existantes.