# Google Workspace & Google Cloud Setup Guide for Sync Meetings

This document explains every step required to configure a brand-new Google Workspace and Google Cloud project for the Sync Meetings feature. Follow it sequentially whenever you need to provision a fresh environment.

---

## 1. Pré-requis
- Posséder ou acheter un nom de domaine (via OVH ou tout autre registrar).
- Créer une instance Google Workspace (ou Cloud Identity) pour ce domaine, avec un compte **Super Admin**.
- Disposer d’un accès administrateur OVH (ou registrar équivalent) pour modifier la zone DNS.

---

## 2. Vérification du domaine côté Google Workspace
1. Dans <https://admin.google.com>, connecte-toi avec le super admin.
2. Lors de l’assistant initial, Google fournit un enregistrement **TXT** de type `google-site-verification=...`.
3. Dans l’espace client OVH :
   - Va dans **Web Cloud → Domaines → [tondomaine] → Zone DNS**.
   - Ajoute un enregistrement **TXT** à la racine (`@`) avec la valeur fournie.
   - TTL : valeur par défaut (3600s) ou la plus faible.
4. Patiente quelques minutes, puis clique sur **Vérifier** dans l’assistant Workspace.

### Configuration des MX
Pour activer Gmail :
1. Supprime tous les enregistrements MX existants.
2. Ajoute ceux de Google :

| Priorité | Cible                     |
|---------|---------------------------|
| 1       | ASPMX.L.GOOGLE.COM        |
| 5       | ALT1.ASPMX.L.GOOGLE.COM   |
| 5       | ALT2.ASPMX.L.GOOGLE.COM   |
| 10      | ALT3.ASPMX.L.GOOGLE.COM   |
| 10      | ALT4.ASPMX.L.GOOGLE.COM   |

3. TTL 3600s. Valide puis attends la propagation (5–60 min).

---

## 3. Activer Google Cloud Platform pour le domaine
1. Admin console → **Applications → Services Google supplémentaires → Google Cloud Platform**.
2. Statut : **Activé pour tout le monde**.
3. Attendre ~15 min que la ressource "Organisation" soit créée.

> **Astuce** : si tu ne vois que "Aucune organisation" dans la console Cloud, crée un projet depuis <https://console.cloud.google.com/cloud-resource-manager>. Cela force la création de l’organisation.

---

## 4. Créer un projet Google Cloud
1. Sur <https://console.cloud.google.com>, connecte-toi avec le super admin.
2. Sélecteur en haut → **Nouveau projet**.
3. Nom : `sync-meetings` (ou autre), Organisation : ton domaine.
4. Valide.

---

## 5. Créer un Service Account + clé JSON
1. Console Cloud → **IAM & Admin → Comptes de service → Créer un compte de service**.
2. Nom : `sync-meeting-service`. Rôle : **Projet → Éditeur** (ou plus fin si besoin).
3. Après création, ouvre le compte → onglet **Clés** → **Ajouter une clé → Créer une clé → JSON**.
4. Télécharge le fichier (servira à `GOOGLE_WORKSPACE_SERVICE_ACCOUNT_KEY`).

### Si la création de clé est bloquée
- Une règle `iam.disableServiceAccountKeyCreation` peut être active.
- Dans **IAM & Admin → Règles d’administration**, mets la contrainte sur *Allow*. (Nécessite le rôle `Organization Policy Administrator`.)

---

## 6. Activer la délégation sur l’ensemble du domaine
1. Dans le compte de service, coche **Activer la délégation sur l’ensemble du domaine** et note l’**ID client**.
2. Dans l’Admin console : **Sécurité → Accès et contrôle des API → Gérer la délégation sur l’ensemble du domaine**.
3. **Ajouter un nouvel ID client** : colle l’ID du service account + scopes :
   ```
   https://www.googleapis.com/auth/calendar
   https://www.googleapis.com/auth/calendar.events
   https://www.googleapis.com/auth/meetings.space.readonly
   ```
4. Valide.

### Marquer l’application comme fiable
1. Admin console → **Sécurité → Contrôle des accès aux applications → Gérer l’accès des applications tierces**.
2. **Ajouter une application → Rechercher par ID client OAuth** → colle l’ID du service account.
3. Défini l’accès sur **Fiable**.

---

## 7. Activer les APIs nécessaires
Dans le projet GCP : **API & Services → Bibliothèque**
- Google Calendar API
- Google Meet REST API
- Google People API (optionnel)
- OAuth 2.0 API (Activée par défaut)

---

## 8. Créer l’application OAuth utilisateur
1. Console Cloud → **API & Services → Identifiants → Créer des identifiants → ID client OAuth**.
2. Type d’application : **Application Web**.
3. URIs autorisés :
   - `http://localhost:3000`
4. URIs de redirection autorisés :
   - `http://localhost:3000/api/google-auth/callback`
5. Récupère le `client_id` et `client_secret` (pour `.env`).

---

## 9. Configurer les variables d’environnement
Dans `apps/leaderboard-client/.env` :
```env
GOOGLE_WORKSPACE_SERVICE_ACCOUNT_KEY={...json complet...}
GOOGLE_WORKSPACE_ADMIN_EMAIL=admin@tondomaine.com
GOOGLE_OAUTH_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=xxxxxxxx
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3000/api/google-auth/callback
```

Autres variables nécessaires (déjà existantes) :
- `CRON_SECRET`, `JWT_SECRET`, etc.

Après modification, redémarre `npm run dev`.

---

## 10. Workflow de test
1. **Connexion utilisateur** : `/login` → admin.
2. **Connecter Google** : `/settings/google-account` → "Connect Google Account" → suit OAuth.
3. **Créer un meeting** : `/sync-meetings` → "New Meeting".
4. Vérifie dans Google Calendar que l’événement + Meet sont créés.
5. Cron ingestion : déclencher `/api/cron/check-meetings` avec `CRON_SECRET` pour traiter les réunions terminées.
6. Page détail : `/sync-meetings/[id]` pour le résumé/analyse.

---

## 11. Résolution des erreurs fréquentes
- **`unauthorized_client` lors de la création de meeting** :
  - Délégation non configurée ou app non marquée comme fiable.
  - `GOOGLE_WORKSPACE_ADMIN_EMAIL` n’a pas de licence Calendar.
- **Validation error (dates)** : s’assurer que `start_time` / `end_time` sont envoyés en ISO (`new Date(...).toISOString()`).
- **`Google OAuth credentials not configured`** : variables OAuth manquantes.

---

En suivant ce guide, tu peux re-déployer l’intégration Sync Meetings sur n’importe quel nouveau domaine Google Workspace en couvrant tous les points critiques (DNS, APIs, service account, OAuth, .env).
