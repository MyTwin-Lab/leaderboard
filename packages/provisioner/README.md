# 📦 Provisioner Package

Package générique pour provisionner des workspaces (branches GitHub, espaces HuggingFace, projets Figma, etc.) lors de la création de challenges et tasks.

## 🎯 Vue d'ensemble

Ce package fournit une interface unifiée pour créer automatiquement des espaces de travail sur différentes plateformes. Il utilise un pattern **Registry + Providers** pour être facilement extensible.

## 🏗️ Architecture

```
packages/provisioner/
├── src/
│   ├── index.ts                    # Façade principale + exports
│   ├── types.ts                    # Interfaces & types
│   ├── registry.ts                 # Registry des providers
│   ├── utils.ts                    # Utilitaires (slugify, génération noms)
│   ├── errors.ts                   # Erreurs normalisées
│   └── providers/
│       └── github-branch.provider.ts  # Provider GitHub
```

## 🔌 Providers disponibles

### GitHub Branch Provider

Crée des branches sur un repository GitHub.

**Configuration requise :**
- Variable d'environnement `GITHUB_TOKEN` avec le scope `repo`

**Fonctionnalités :**
- Création de branches depuis une branche de base
- Détection des branches existantes (retourne `ready` sans erreur)
- Gestion des erreurs d'authentification

## 📖 Utilisation

### Provisionner un workspace pour un challenge

```typescript
import { provisionChallengeWorkspace } from 'packages/provisioner/src/index.js';

const result = await provisionChallengeWorkspace({
  challengeIndex: 7,
  challengeTitle: 'Admin Experience Update',
  repoExternalId: 'MyTwin-Lab/leaderboard',
  repoType: 'github',
});

// Résultat:
// {
//   provider: 'GitHub Branch',
//   workspaceType: 'git_branch',
//   ref: 'refs/heads/challenge/007-admin-experience-update',
//   url: 'https://github.com/MyTwin-Lab/leaderboard/tree/challenge/007-admin-experience-update',
//   status: 'ready',
//   meta: { baseBranch: 'main', sha: '...', createdAt: '...' }
// }
```

### Provisionner un workspace pour une task

```typescript
import { provisionTaskWorkspace } from 'packages/provisioner/src/index.js';

const result = await provisionTaskWorkspace({
  challengeIndex: 7,
  taskTitle: 'Setup Environment',
  repoExternalId: 'MyTwin-Lab/leaderboard',
  repoType: 'github',
  challengeBranchRef: 'refs/heads/challenge/007-admin-experience-update', // optionnel
});

// Résultat:
// {
//   provider: 'GitHub Branch',
//   workspaceType: 'git_branch',
//   ref: 'refs/heads/task/007-setup-environment',
//   url: 'https://github.com/MyTwin-Lab/leaderboard/tree/task/007-setup-environment',
//   status: 'ready',
//   meta: { baseBranch: 'challenge/007-admin-experience-update', ... }
// }
```

## 🔧 Convention de nommage des branches

| Type | Format | Exemple |
|------|--------|---------|
| Challenge | `challenge/{index}-{slug}` | `challenge/007-admin-experience-update` |
| Task | `task/{challenge-index}-{slug}` | `task/007-setup-environment` |

L'index est padé sur 3 chiffres (ex: `007`).

## 🚀 Ajouter un nouveau provider

1. Créer un fichier dans `src/providers/` implémentant `WorkspaceProvider`:

```typescript
import type { WorkspaceProvider, ProvisionRequest, ProvisionResult } from '../types.js';

export class FigmaProjectProvider implements WorkspaceProvider {
  readonly type = 'figma_project';
  readonly name = 'Figma Project';

  async provision(request: ProvisionRequest): Promise<ProvisionResult> {
    // Implémenter la logique de création
  }

  async getStatus(parentRef: string, ref: string): Promise<WorkspaceStatus> {
    // Vérifier si le workspace existe
  }
}
```

2. Enregistrer le provider dans `src/index.ts`:

```typescript
import { FigmaProjectProvider } from './providers/figma-project.provider.js';

// Dans initializeProviders():
if (process.env.FIGMA_TOKEN) {
  ProvisionerRegistry.register(new FigmaProjectProvider());
}
```

3. Ajouter le mapping dans `src/utils.ts`:

```typescript
const mapping: Record<string, string> = {
  'github': 'git_branch',
  'figma': 'figma_project',  // Nouveau
};
```

## 📊 Stockage en base de données

Les résultats du provisioning sont stockés dans :

- **`challenge_repos`** : pour les workspaces de challenges
  - `workspace_provider`, `workspace_ref`, `workspace_url`, `workspace_status`, `workspace_meta`

- **`task_workspaces`** : pour les workspaces de tasks
  - Mêmes champs que `challenge_repos`

## ⚠️ Gestion des erreurs

| Erreur | Description |
|--------|-------------|
| `ProviderNotFoundError` | Aucun provider enregistré pour ce type |
| `MissingConfigurationError` | Token/credentials manquants |
| `ProviderAuthenticationError` | Échec d'authentification |
| `ParentResourceNotFoundError` | Repo/projet parent introuvable |
| `WorkspaceAlreadyExistsError` | Le workspace existe déjà (non bloquant) |

## 🔐 Variables d'environnement

| Variable | Description | Requis pour |
|----------|-------------|-------------|
| `GITHUB_TOKEN` | Personal Access Token GitHub | GitHub provider |

## 📝 Intégration dans les APIs

Le provisioning est déclenché automatiquement :

1. **Création challenge-repo** (`POST /api/repos/challenge-repos`)
   - Crée la branche du challenge sur le repo associé

2. **Assignation à une task** (`POST /api/tasks/[id]/assign`)
   - Crée la branche de la task basée sur la branche du challenge parent
