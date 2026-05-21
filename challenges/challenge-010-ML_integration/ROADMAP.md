# Challenge 010 – ML Integration

## ROADMAP

### Phase 0 — Refactoring du pipeline d'évaluation

- 0.1 Refactorer le `ConnectorRegistry` en Map de factories (OCP) : ajouter un connecteur = appeler `register()`, sans modifier le fichier.
- 0.2 Ajouter la constante `REPO_TYPE_TO_GRID` centralisant le mapping `repoType → gridSlug`.
- 0.3 Décomposer `evaluateTask()` en étapes pipeline privées (SRP) : `startRun`, `buildSnapshot`, `loadGrid`, `buildEvalContribution`, `upsertContribution`, `finalizeRun`.
- 0.4 Injecter les dépendances du `TaskEvaluationService` par constructeur (testabilité).
- 0.5 Extraire `TaskContextService` pour la résolution du contexte task/challenge/workspaces.
- 0.6 Extraire `TaskDetailsService` et `TaskAssignService` dans la couche application.
- 0.7 Réorganiser les services dans `packages/services/evaluation/`, supprimer le pipeline de sync challenge et le webhook service obsolète.

---

### Phase 1 — Connecteur Kaggle

- 1.1 Implémenter `KaggleConnector` supportant les deux sous-types : `kaggle_dataset` et `kaggle_model`.
- 1.2 `fetchItems()` : récupérer metadata dataset (titre, tags, downloadCount…) ou modèle (framework, overview…).
- 1.3 `fetchItemContent()` : retourner le README.md du dataset ou le `model_card.json` du modèle dans le même format que le connecteur GitHub (compatible `SnapshotService`).
- 1.4 Enregistrer `kaggle_dataset` et `kaggle_model` dans le `ConnectorRegistry`.
- 1.5 Ajouter `KAGGLE_USERNAME` et `KAGGLE_KEY` dans le schéma de config et l'`.env.example`.

---

### Phase 2 — UI Kaggle & HowToContribute

- 2.1 Ajouter les types `kaggle_dataset` et `kaggle_model` dans le formulaire de repo admin (`RepoForm`).
- 2.2 Ajouter la vérification du type Kaggle dans la route `/api/tasks/[id]/workspace` pour accepter la soumission d'un lien Kaggle utilisateur.
- 2.3 Sur la page `/tasks/[id]`, afficher un champ de saisie de lien Kaggle pour les workspaces de type Kaggle sur les tâches concurrentes.
- 2.4 Créer le composant `HowToContribute` : popover contextuel avec instructions et blocs de commandes copiables, adapté au type de repo (GitHub → clone/push, dataset Kaggle → structure de fichiers, modèle Kaggle → structure de fichiers).

---

### Phase 3 — Thème paramétrable (white-label)

- 3.1 Définir l'interface `ThemeConfig` : `appName`, `logoPath`, `colors` (brandCP, primary100/200/300, background, backgroundDark, gradient), `nav` (liens about/leaderboard/challenges).
- 3.2 Créer le thème par défaut MyTwin Lab dans `themes/default/config.ts`.
- 3.3 Implémenter `resolveTheme()` : charge le thème via `NEXT_PUBLIC_THEME`, fallback sur le thème par défaut.
- 3.4 Injecter les CSS vars du thème dans le layout racine (`layout.tsx`) pour que Tailwind les lise à runtime.
- 3.5 Câbler les props de thème sur `Navbar` et `GradientBackground` (appName, couleurs).
- 3.6 Gitignorer les dossiers `themes/*/` (hors `default`) pour permettre des thèmes privés non commités.
