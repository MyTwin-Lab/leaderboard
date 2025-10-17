# 📦 Connectors Package

Package de connecteurs externes pour interagir avec différentes plateformes (GitHub, Google Drive, etc.).

## 🎯 Vue d'ensemble

Ce package fournit une interface unifiée pour se connecter à des services externes et récupérer des données. Chaque connecteur implémente l'interface `ExternalConnector` pour garantir une cohérence dans l'utilisation.

## 🏗️ Architecture

### Interface principale : `ExternalConnector`

Tous les connecteurs implémentent cette interface qui définit les méthodes essentielles :

```typescript
interface ExternalConnector {
  name: string;                                    // Nom du connecteur
  type: ConnectorType;                             // Type (github, google_drive, etc.)
  authConfig: ConnectorAuthConfig;                 // Configuration d'authentification
  
  connect(): Promise<void>;                        // Initialise la connexion
  testConnection(): Promise<boolean>;              // Teste la validité de la connexion
  fetchItems(options?): Promise<ExternalItem[]>;   // Récupère une liste d'éléments
  fetchItemContent(itemId: string): Promise<any>;  // Récupère le contenu détaillé
  disconnect?(): Promise<void>;                    // Nettoyage optionnel
}
```

### Types de données

#### `ConnectorAuthConfig`
Configuration d'authentification flexible :
- `apiKey`: Clé API
- `token`: Token d'accès
- `clientId` / `clientSecret`: Credentials OAuth
- `refreshToken`: Token de rafraîchissement
- Extensible avec `[key: string]: any`

#### `ExternalItem`
Représentation unifiée d'un élément externe :
- `id`: Identifiant unique
- `name`: Nom lisible
- `type`: Type d'élément (file, commit, message, etc.)
- `url`: URL optionnelle
- `metadata`: Métadonnées additionnelles

## 🔌 Connecteurs disponibles

### 1. GitHub Connector (`GitHubExternalConnector`)

**Objectif** : Récupérer les commits et le contenu des fichiers modifiés d'un repository GitHub.

#### Configuration
```typescript
const connector = new GitHubExternalConnector({
  token: "ghp_xxxxx",        // Personal Access Token
  owner: "facebook",         // Propriétaire du repo
  repo: "react",             // Nom du repo
  branch: "main"             // Branche (optionnel, défaut = branche par défaut)
});
```

#### Fonctionnalités

**`fetchItems(options)`** - Récupère les commits
- Options disponibles :
  - `since`: Date de début (ISO 8601)
  - `until`: Date de fin (ISO 8601)
  - `author`: Filtrer par auteur (username GitHub)
  - `maxCommits`: Limite de commits (défaut: 1000)

- Retourne : Liste de commits avec métadonnées (SHA, auteur, message, stats)

**`fetchItemContent(commitSha)`** - Récupère le contenu des fichiers modifiés
- Filtre automatiquement les fichiers texte (`.ts`, `.js`, `.py`, `.md`, etc.)
- Ignore les fichiers supprimés et binaires
- Retourne le contenu décodé en UTF-8
- Option `includePatch` pour inclure les diffs

#### Exemple d'utilisation
```typescript
await connector.connect();

// Récupérer les commits du dernier mois
const commits = await connector.fetchItems({
  since: "2024-09-01T00:00:00Z",
  author: "gaearon",
  maxCommits: 50
});

// Récupérer le contenu d'un commit
const content = await connector.fetchItemContent(commits[0].id);
console.log(content.modifiedFiles); // Fichiers modifiés avec leur contenu
```

---

### 2. Google Drive Connector (`GoogleDriveConnector`)

**Objectif** : Accéder aux fichiers et dossiers Google Drive via OAuth2.

#### Configuration
```typescript
const connector = new GoogleDriveConnector({
  clientId: "xxx.apps.googleusercontent.com",
  clientSecret: "GOCSPX-xxxxx",
  refreshToken: "1//xxxxx",
  redirectUri: "urn:ietf:wg:oauth:2.0:oob" // Optionnel
});
```

#### Fonctionnalités

**`fetchItems(options)`** - Liste les fichiers/dossiers
- Options disponibles :
  - `folderId`: ID du dossier parent
  - `query`: Requête de recherche Google Drive
  - `pageSize`: Nombre d'éléments (défaut: 100)
  - `orderBy`: Critère de tri (défaut: "modifiedTime desc")
  - `mimeType`: Filtrer par type MIME

- Retourne : Liste de fichiers avec métadonnées (mimeType, taille, date de modification)

**`fetchItemContent(itemId)`** - Télécharge le contenu d'un fichier
- Gère les **Google Docs natifs** (Docs, Sheets, Slides) → export automatique en text/plain
- Gère les **fichiers texte** → retour en string UTF-8
- Gère les **fichiers binaires** → retour en Buffer
- Gère les **dossiers** → retour métadonnées uniquement

#### Types de fichiers détectés
- `folder`: Dossiers
- `google_doc`: Documents Google natifs
- `text`: Fichiers texte
- `image`, `video`, `audio`: Médias
- `file`: Autres fichiers

#### Exemple d'utilisation
```typescript
await connector.connect();

// Lister les fichiers d'un dossier
const files = await connector.fetchItems({
  folderId: "1ABC...XYZ",
  mimeType: "application/pdf",
  pageSize: 50
});

// Télécharger un Google Doc
const content = await connector.fetchItemContent(files[0].id);
console.log(content.content); // Contenu en texte brut
```

## 🛠️ Utilisation générale

### Pattern commun pour tous les connecteurs

```typescript
// 1. Créer le connecteur
const connector = new SomeConnector(config);

// 2. Se connecter
await connector.connect();

// 3. Tester la connexion
const isValid = await connector.testConnection();
if (!isValid) throw new Error("Connection failed");

// 4. Récupérer des éléments
const items = await connector.fetchItems(options);

// 5. Récupérer le contenu détaillé
for (const item of items) {
  const content = await connector.fetchItemContent(item.id);
  // Traiter le contenu...
}

// 6. Nettoyer (optionnel)
await connector.disconnect();
```

## 📝 Bonnes pratiques

1. **Toujours appeler `connect()` avant toute opération**
2. **Utiliser `testConnection()` pour valider les credentials**
3. **Gérer les erreurs** : Tous les connecteurs lancent des exceptions en cas d'échec
4. **Respecter les rate limits** des APIs externes
5. **Nettoyer les ressources** avec `disconnect()` quand c'est terminé

## 🔐 Sécurité

- **Ne jamais hardcoder les tokens** dans le code
- Utiliser des variables d'environnement pour les credentials
- Stocker les refresh tokens de manière sécurisée
- Vérifier les permissions des tokens (scopes OAuth)

## 🚀 Extension

Pour ajouter un nouveau connecteur :

1. Créer une classe qui implémente `ExternalConnector`
2. Définir le `type` dans `ConnectorType`
3. Implémenter toutes les méthodes requises
4. Ajouter le fichier dans `implementation/`
5. Documenter les options spécifiques dans ce README

## 📦 Dépendances

- **GitHub** : `octokit` - Client officiel GitHub API
- **Google Drive** : `googleapis` - Client officiel Google APIs
- **Authentification** : `google-auth-library` - OAuth2 pour Google

## 🔄 Types de connecteurs supportés

```typescript
type ConnectorType = 'github' | 'google_drive' | 'huggingface' | 'slack' | string;
```

Le type est extensible pour supporter de futurs connecteurs.
