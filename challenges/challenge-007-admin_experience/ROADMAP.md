# Challenge 007 – Admin Evaluation Experience Roadmap

## Phases

### **Phase 0 – Discovery & cadrage**
- 0.1 Cartographier les workflows d’évaluation existants (ChallengeService, Evaluator, triggers).
- 0.2 Identifier les points de collecte possibles pour les métadonnées de run (Challenge, trigger, période, statut, erreurs).
- 0.3 Définir les KPIs et vues essentielles de l’historique (statut, durée, # contributions).

### **Phase 1 – Modèle de données & instrumentation backend**
- 1.0 Refactoriser ChallengeService en plusieurs fichiers pour séparer les responsabilités (contexte, enregistrement, pipeline Evaluator, logging)
- 1.1 Ajouter les tables `evaluation_runs` et `evaluation_run_contributions` dans `packages/database-service`.
- 1.2 Étendre ChallengeService pour créer un enregistrement de run dès le lancement et l’enrichir au fil du pipeline (timestamps, statut, payload, erreurs).
- 1.3 Persister pour chaque contribution trouvée : UUID DB, challenge, fenêtre temporelle, source.

### **Phase 2 – API & services de consultation**
- 2.1 Exposer des endpoints Next Route Handlers /api/admin/evaluation-runs (liste + détail).
- 2.2 Ajouter un endpoint pour récupérer les contributions d’un run (pagination, filtre par statut).
- 2.3 Garantir l’accès protégé (RBAC admin) et loguer les consultations sensibles.

### **Phase 3 – Admin UI (Next.js)**
- 3.1 Créer la page `/admin/evaluations` avec tableau historique (statut, challenge, trigger, dates, durée, taille lot).
- 3.2 Ajouter une vue détail (drawer ou page) listant les contributions : UUID, auteur, step, timestamps, évaluation associée.
- 3.3 Afficher les erreurs de run et un call-to-action “Relancer” sur les runs échoués.

### **Phase 4 – Relance & opérations**
- 4.1 Implémenter l’API `POST /api/admin/evaluation-runs/:id/retry` (copie des paramètres, nouvelles dates).
- 4.2 Pré-remplir la fenêtre temporelle lors de la relance (dates start/end du run initial), avec option de les ajuster.
- 4.3 Journaliser les relances (qui relance, pourquoi) et notifier en cas d’erreur répétée.

### **Phase 5 – Qualité, sécurité & déploiement**
- 5.1 Tests unitaires (repos + services), d’intégration (API + DB), et E2E (parcours admin → relance).
- 5.2 Mettre à jour `.env.example`, `docs/challenge-workflow.md` et runbooks admin.
- 5.3 Feature flag pour activer la nouvelle section admin, puis bascule progressive.

### **Phase 6 – Gestion des grilles d’évaluation (Design System Evaluator)**
- 6.1 Modéliser les grilles dans la base (tables `evaluation_grids`, `evaluation_grid_categories`, `evaluation_grid_subcriteria`) + repositories/entités Drizzle.
- 6.2 Ajouter les services backend pour CRUD + publication des grilles et fournir un cache vers `packages/evaluator`.
- 6.3 Créer l’onglet `/admin/evaluation-grids` : listing, visualisation détaillée, édition inline (critères, poids, instructions) et création d’une nouvelle grille.
- 6.4 Injecter les nouvelles grilles dans le pipeline Evaluator (remplacer les templates statiques dans `packages/evaluator/grids`, gérer versionning + fallback) et fournir des tests de régression.

### **Phase 7 – Provisioning multi-repo (workspace orchestration)**
- 7.1 Cartographier les types de repos liés aux challenges (code, modèle, dataset…) et définir les providers cibles (GitHub, Hugging Face, etc.).
- 7.2 Créer un package `packages/provisioner` générique (registry + drivers) capable de provisionner une branche GitHub, un espace modèle, ou tout autre workspace selon le type de repo.
- 7.3 Intégrer ce provisioner dans le flux de création/association d’un challenge (ChallengeService + API admin) et persister l’état côté `challenge_repos`.
- 7.4 Propager l’état de provisioning jusqu’à l’admin (résumé du workspace, lien externe, statut) pour suivre la disponibilité des environnements.
