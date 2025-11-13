# Tests API

Ce dossier contient les tests automatisés de l'API.

## 🧪 Test complet

Le fichier `api.test.ts` teste toutes les routes de l'API et nettoie automatiquement les données créées.

### Prérequis

1. **Démarrer le serveur API** :
   ```bash
   cd packages/api
   npm run dev
   ```

2. **Dans un autre terminal, lancer les tests** :
   ```bash
   npx tsx packages/api/test/api.test.ts
   ```

### Ce qui est testé

- ✅ Health check
- ✅ Projects (CRUD)
- ✅ Challenges (CRUD + context)
- ✅ Users (CRUD)
- ✅ Contributions (CRUD + filtres)
- ✅ Leaderboard (classement + stats)

### Nettoyage automatique

Le test supprime automatiquement toutes les données créées :
- Contributions
- Users
- Challenge
- Projet

**Aucune donnée existante n'est supprimée**, seules les données de test sont nettoyées.

## 📝 Configuration

Par défaut, le test utilise `http://localhost:3001`.

Pour changer l'URL de l'API, définissez la variable d'environnement :

```bash
API_URL=http://localhost:4000 npx tsx packages/api/test/api.test.ts
```

## 🔍 Exemple de sortie

```
🧪 Test de l'API MyTwin Leaderboard

📡 API URL: http://localhost:3001

🏥 Test 1: Health Check
   ✅ Health check OK

📁 Test 2: Projects
   📋 2 projets existants
   ✅ Projet créé: abc-123
   ✅ Projet récupéré: Test Project API
   ✅ Projet modifié: Test Project API (Updated)

...

🧹 Nettoyage des données de test...
   🗑️  Contribution supprimée: xyz-789
   🗑️  User 1 supprimé: def-456
   🗑️  Challenge supprimé: ghi-789
   🗑️  Projet supprimé: abc-123

✅ Nettoyage terminé !
✅ Tous les tests sont passés !
```
