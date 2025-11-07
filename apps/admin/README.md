# 🎯 MyTwin Leaderboard - Backoffice Admin

Interface d'administration pour gérer le système de leaderboard.

## 🚀 Démarrage

### Prérequis

1. **API démarrée** :
   ```bash
   cd packages/api
   npm run dev
   ```

2. **Ouvrir le backoffice** :
   - Ouvrez `apps/admin/index.html` dans votre navigateur
   - Ou utilisez un serveur local :
     ```bash
     # Avec Python
     python -m http.server 3000
     
     # Avec Node.js
     npx serve apps/admin
     ```

### Connexion

- **Username** : `admin`
- **Password** : `MyTwinAdmin2025!` (défini dans `.env`)

---

## ✨ Fonctionnalités

### 📊 Dashboard
- Vue d'ensemble des statistiques
- Nombre de projets, challenges, users, contributions

### 📁 Projets
- ✅ Liste des projets
- ✅ Créer un projet
- ✅ Modifier un projet
- ✅ Supprimer un projet

### 🎯 Challenges
- ✅ Liste des challenges
- ✅ Créer un challenge
- ✅ Modifier un challenge
- ✅ Supprimer un challenge
- ✅ **Lancer une évaluation Sync** (bouton 🔄 Sync)
- ✅ **Clôturer et distribuer rewards** (bouton 🏆 Clôturer)

### 👥 Users
- ✅ Liste des utilisateurs
- ✅ Créer un utilisateur
- ✅ Supprimer un utilisateur

### 💡 Contributions
- ✅ Liste des contributions
- ✅ Filtrer par challenge
- ✅ Voir les scores et rewards

### 🏆 Leaderboard
- ✅ Classement global ou par challenge
- ✅ Statistiques détaillées du challenge
- ✅ Pool de rewards, CP distribués, score moyen

---

## 🔐 Sécurité

- **Authentification Basic Auth** pour toutes les actions admin
- Les routes GET (consultation) sont publiques
- Les routes POST/PUT/DELETE nécessitent l'authentification

---

## 🎨 Technologies

- **HTML/CSS/JS** pur (pas de framework)
- **Fetch API** pour les appels REST
- **LocalStorage** pour la session admin
- **Responsive design**

---

## 📡 Routes API utilisées

| Fonctionnalité | Endpoint | Méthode |
|----------------|----------|---------|
| Liste projets | `/api/projects` | GET |
| Créer projet | `/api/projects` | POST |
| Modifier projet | `/api/projects/:id` | PUT |
| Supprimer projet | `/api/projects/:id` | DELETE |
| Liste challenges | `/api/challenges` | GET |
| Créer challenge | `/api/challenges` | POST |
| Sync Meeting | `/api/challenges/:id/sync` | POST |
| Clôturer challenge | `/api/challenges/:id/close` | POST |
| Liste users | `/api/users` | GET |
| Créer user | `/api/users` | POST |
| Liste contributions | `/api/contributions` | GET |
| Leaderboard | `/api/leaderboard` | GET |
| Stats challenge | `/api/leaderboard/challenge/:id/stats` | GET |

---

## 🔧 Configuration

Pour changer l'URL de l'API, modifiez dans `app.js` :

```javascript
const API_URL = 'http://localhost:3001';
```

### Configuration Google Drive (sélection de dossier)

1. Créez un client OAuth 2.0 « Application Web » dans Google Cloud Console et ajoutez vos origines/redirects `http://localhost`.
2. Activez les APIs **Google Drive** et **Google Picker** sur le même projet.
3. Renseignez votre `clientId` et `apiKey` dans `google-config.js` (les valeurs `YOUR_...` sont des placeholders).
4. Ajustez la liste des scopes si nécessaire (`drive.metadata.readonly` par défaut).
5. Rechargez la page après modification pour prendre en compte la configuration.

---

## 📝 Notes

- Les credentials admin sont stockés en Base64 dans le LocalStorage
- Déconnexion = suppression du LocalStorage
- Toutes les actions destructives demandent confirmation




ATTENTION : 

Oui, tout ce qui est dans 
apps/admin/google-config.js
 est servi tel quel par le navigateur : l’ID client et la clé API y sont lisibles par n’importe qui qui ouvre la page (même sans être connecté, puisqu’il s’agit d’un script statique). C’est normal sur le web : les clients OAuth pour applications SPA et les clés API « publiques » sont considérés comme exposés et doivent donc être restreints côté Google Cloud Console (domaines autorisés, quotas, etc.).

Points à retenir :

Client ID OAuth (SPA)
Il est conçu pour vivre côté front, donc pas réellement sensible.
Vérifie malgré tout que tu n’autorises que http://localhost:PORT (et plus tard ton domaine de prod) dans les origines/redirects.
Clé API Google Picker
Restreins-la dans la console (Utilisation HTTP, domaines autorisés) pour éviter qu’elle ne soit utilisable ailleurs.
Sur un front statique, on ne peut pas la cacher complètement.
Si tu veux limiter l’exposition
Option : ne charger 
google-config.js
 qu’après la Basic Auth (par exemple en générant dynamiquement le script côté backend), mais ça reste accessible à quiconque a les identifiants admin.
Option plus robuste : servir la configuration via un endpoint backend qui injecte les valeurs après vérification Basic Auth. Ça ajoute une étape de fetch mais garde les secrets hors du bundle statique.
Je me base sur la configuration ajoutée lors de l’intégration Drive (mémoire « Intégration sélection dossier Google Drive - Front admin »).