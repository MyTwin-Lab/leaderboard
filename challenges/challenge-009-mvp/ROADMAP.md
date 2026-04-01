# Challenge 009 – MVP Release

## ROADMAP

### Phase 0 — Modèle utilisateur & profil

- 0.1 Fusionner les tables `google_accounts` et `users` pour unifier le modèle utilisateur.
- 0.2 Permettre à un utilisateur de modifier son profil depuis `/contributors/me`.

---

### Phase 1 — Design & évaluation

- 1.1 Refonte du design des pages `/contributors/me`, `/tasks/[id]`, `/challenges/[id]` et `/sync-meetings/[id]`.
- 1.2 Afficher les tâches assignées sur `/contributors/me` avec évaluation et dernier score par tâche.
- 1.3 Créer un composant d'onboarding contextuel sur `/tasks/[id]` pour guider l'accès et l'utilisation des workspaces (GitHub for now).

---

### Phase 2 — Tiroir d'onboarding

- 2.1 Créer un tiroir d'onboarding avec des quêtes guidées, ouvert automatiquement à la première connexion.
- 2.2 Implémenter la complétion des quêtes.

---

### Phase 3 — Documentation API & modèle de données

- 3.1 Ajouter une documentation OpenAPI/Swagger pour toutes les routes de l'API.
- 3.2 Lier les tâches à un repo de challenge et exposer cette liaison dans l'admin et les pages publiques.