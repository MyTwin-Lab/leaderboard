# Unified Leaderboard & Admin Interface – SPEC

## 1. Contexte & objectifs

- **Problème identifié**
    
    Deux interfaces distinctes (Next.js pour le leaderboard public, SPA statique pour l’admin) créent une dette UX, des risques de sécurité (Basic Auth exposée, absence de RBAC) et compliquent la maintenance.
    
- **Objectif projet**
    
    Unifier les interfaces dans une application Next.js unique offrant le leaderboard public, les capacités d’administration et des contrôles d’accès différenciés par rôle.
    
- **Valeur attendue**
    - Expérience cohérente pour tous les utilisateurs.
    - Sécurité renforcée (authentification moderne, gestion des rôles).
    - Simplification du déploiement et de la maintenance.
    - Meilleure observabilité des actions sensibles.

## 2. Stakeholders & utilisateurs

| Rôle | Description | Besoins principaux |
| --- | --- | --- |
| **Administrateur** | Gère projets, challenges, utilisateurs, synchronisations. | CRUD complet + opérations sensibles + logs. |
| **Manager** (option) | Peut consulter / déclencher certains workflows sans tout modifier. | Accès lecture + actions ciblées. |
| **Contributeur** | Consulte le leaderboard et ses stats personnelles. | Vue publique sans actions privilégiées. |
| **Ops / Dev** | Maintient la plateforme, suit incidents et accès. | Observabilité, documentation, pipelines fiables. |

## 3. Contraintes & hypothèses

- Monorepo Node/TypeScript, Next.js côté client.
- Authentification JWT (access + refresh) ou session signée, cookies HTTP-only.
- RBAC basé sur le champ `users.role` (déjà en base).
- Toutes les routes API doivent passer par `packages/api`.
- Les secrets sont gérés via le module `packages/config`.
- Tests d’intégration exécutés via Node (pas de Cypress/E2E lourd planifié à ce stade).
- CI/CD GitHub Actions disponible.

## 4. Architecture cible

### 4.1 Frontend (Next.js)

- **Applications**
    - `/` → Leaderboard public (SSR/ISR).
    - `/admin` (et sous-routes) → Interface admin protégée.
- **Shared UI**
    - Design system (tailwind/chakra/comp maison).
    - Layout commun + menu latéral conditionnel par rôle.
- **Gestion Auth**
    - Service `authClient` pour login, refresh, logout.
    - Provider React (`AuthContext`) pour hydrater l’état utilisateur.
    - Middleware Next: redirection automatique vers `/login` si route protégée.

### 4.2 Backend (Next.js – Route Handlers)

**Suppression complète de packages/api (serveur Express)**

Le serveur Express standalone (`packages/api/server.ts`) sera entièrement supprimé. Toutes les routes API seront migrées vers Next.js Route Handlers dans `apps/leaderboard-client/app/api/*`.

- **Route Handlers Next.js** (`app/api/*`)
    - **Auth** : POST /api/auth/login, /api/auth/refresh, /api/auth/logout
    - **Challenges** : CRUD complet + /api/challenges/:id/sync, /api/challenges/:id/close, /api/challenges/:id/team
    - **Projects** : CRUD /api/projects
    - **Users** : CRUD /api/users
    - **Repos** : CRUD /api/repos
    - **Contributions** : CRUD /api/contributions
    - **Leaderboard** : GET /api/leaderboard (lecture publique)
    - Toutes les routes admin (POST/PUT/DELETE) protégées par vérification JWT + RBAC

- **Réutilisation des packages existants**
    - `packages/services/challenge.service.ts` → Importé directement dans les Route Handlers
    - `packages/database-service/repositories/*` → Utilisés tels quels (ChallengeRepository, UserRepository, etc.)
    - `packages/config` → Configuration centralisée (secrets, DB, API keys)
    - `packages/connectors` → Connecteurs GitHub, Google Drive conservés

- **Middleware Next.js** (`middleware.ts`)
    - Vérification JWT pour routes /admin/* et /api/* (sauf /api/auth/login, /api/auth/refresh publiques)
    - Extraction du rôle utilisateur depuis le payload JWT
    - Redirection automatique vers /login si non authentifié
    - Vérification RBAC (admin/manager/viewer) avant accès aux ressources sensibles
    - Matcher Next.js : `['/admin/:path*', '/api/challenges/:path*', '/api/projects/:path*', ...]`

- **Validation & sécurité**
    - Zod appliqué dans chaque Route Handler pour valider `body`, `params`, `query`
    - Gestion d'erreurs standardisée (try/catch + NextResponse avec codes HTTP appropriés) 
    - Journaux structurés côté serveur pour tracer les accès critiques (création/suppression challenge, sync, etc.)
    - CORS configuré via headers Next.js (pas de middleware Express cors)

- **Gestion des tokens**
    - Stockage HTTP-only cookies via `cookies()` de Next.js (access + refresh)
    - Table `refresh_tokens` en base pour invalidation et rotation
    - Durées de vie : access token 15min, refresh token 7 jours
    - Rotation du refresh token à chaque renouvellement (sécurité renforcée)

### 4.3 Base de données

- **Table `refresh_tokens`** (obligatoire)
    ```sql
    CREATE TABLE refresh_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      INDEX idx_user_id (user_id),
      INDEX idx_expires_at (expires_at)
    );
    ```
- **Colonne `role` dans `users`** (si absente)
    - Migration pour ajouter `role VARCHAR(20) DEFAULT 'viewer'`
    - Valeurs possibles : `admin`, `manager`, `viewer`

### 4.4 Observabilité & sécurité

- Intégration logs structurés.
- Dashboard minimal (ex. Grafana) hors scope mais prévoir export logs.
- Security headers via Next.js + Helmet (API).
- Rate limiting sur auth endpoints.

## 5. Parcours utilisateurs

1. **Public**
    - Accède au site → voit leaderboard.
    - Peut consulter stats challenge, filtres, profil user (lecture seule).
2. **Admin**
    - Arrive sur `/login` → saisit identifiants → reçoit cookie HTTP-only + refresh.
    - Navigue vers `/admin/challenges` → voit la liste, peut créer/éditer, lancer sync.
    - Déclenche un Sync → appelle API protégée → ChallengeService.
    - Consulte logs et notifications en cas d’erreur.
3. **Manager** (si mis en place)
    - Même login.
- Voit certaines sections (ex. consultation, déclenchement sync) mais pas la suppression.
1. **Déconnexion**
    - Bouton logout → clear cookies/access token → redirection `/login`.

## 6. Livrables par chantier (alignés sur la roadmap)

### 6.1 Socle applicatif unifié

- Migration des écrans admin en pages Next.js.
- Setup design system + storybook (optionnel).
- Layout commun + routes protégées.

### 6.2 Authentification & autorisation

- Endpoints auth + gestion tokens.
- Middleware RBAC côté API et front (guard).
- Gestion storage cookies + refresh.

### 6.3 Validation / API hardening

- Middleware Zod appliqué aux routes critiques.
- Standardisation des réponses d’erreur.
- Tests d’intégration pour accès autorisés/interdits.

### 6.4 UX & accessibilité

- Feedbacks visuels (loaders, toasts).
- Badge rôle utilisateur + menu contextuel.
- Vérification responsive & A11y.

### 6.5 Ops & déploiement

- Mise à jour `.env.example` (variables auth).
- Documentation (README, runbook, authentification).
- Pipelines CI/CD mis à jour (tests, lint, build Next).
- Monitoring logs d’accès admin (journalisation).

### 6.6 Migration & feature flag

- Feature flag pour activer la nouvelle interface.
- Scripts pour créer/mettre à jour les rôles utilisateur.
- Plan de communication interne + validation sur staging.

## 7. Sécurité

- Secrets injectés via `packages/config`.
- Cookies `Secure`, `HttpOnly`, `SameSite=strict`.
- CSRF : double submit cookie/token ou anti-CSRF Next.
- Rate limiting sur `/auth/login`.
- Logs audités (suppression challenge, run sync).
- Revue de sécurité (checklist OWASP) avant mise en prod.

## 8. Qualité & tests

| Niveau | Exemples |
| --- | --- |
| **Unitaires** | Hooks auth, composants UI, middleware RBAC. |
| **Intégration** | Routes API avec payloads validés, RBAC, génération tokens. |
| **E2E léger** | Parcours login → page admin → action (ex. via Playwright). |
| **Performance** | Vérifier absence de régressions (Time To First Byte). |

## 9. Checklist d’acceptation

- ✅ Login sécurisé, logout fonctionnel, tokens invalidés.
- ✅ Les routes admin renvoient 403 aux utilisateurs non autorisés.
- ✅ Tous les formulaires admin passent par une validation Zod.
- ✅ UI responsive, accessible, unifiée.
- ✅ Documentation & `.env.example` à jour.
- ✅ Pipelines CI/CD verts (lint/test/build).
- ✅ Observabilité en place (logs structurés, alertes de base).

## 10. Points ouverts / risques

- Choix final du provider d’auth (maison vs clé en main).
- Gestion des refresh tokens (BDD vs stateless).
- Montée de charge : vérifier que le SSR Next et l’API partagent bien les ressources (optimiser si besoin).
- Coordination du basculement : prévoir support utilisateurs lors de la migration.

---

**Références**

- Module config centralisé (packages/config/index.ts).
- Challenge 001 (Architecture initiale).
- Roadmap “Unification interface leaderboard/admin”.