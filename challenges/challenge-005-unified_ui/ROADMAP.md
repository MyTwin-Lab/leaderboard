## **Roadmap de mutualisation Leaderboard/Admin avec accès restreint**

**1. Socle applicatif unifié**

- **Migration backoffice vers Next.js** : Reprendre les écrans admin actuels (**`apps/admin`**) en pages Next.js pour partager le même build, routing et tooling que le leaderboard (déjà sous Next.js).
- **Design system commun** : Créer un kit de composants (layout, tables, formulaires, notifications) pour harmoniser UI/UX et éviter la duplication HTML/CSS.
- **Navigation conditionnelle** : Mettre en place une structure de menu qui masque/affiche dynamiquement les sections admin selon le rôle utilisateur.

**2. Refactoring API as NextJS Server**
- **Refactorer toutes les routes API** : Les routes dans packages/api doivent être backend NextJS
et passer par le nouveau middleware d'erreur et d'authification

**3. Authentification & autorisation robustes**

- **Flux d’auth sécurisé** : Remplacer la Basic Auth locale par un login API + tokens HTTP-only (auth + refresh), suppression du stockage Base64 côté client.
- **Gestion des rôles** : Étendre les entités utilisateurs pour différencier les profils (admin, manager, viewer), exposer ces infos dans les réponses d’auth.
- **Middlewares RBAC** : Sur l’API, valider l’accès via un middleware rôle/permissions, et renvoyer des erreurs normalisées 401/403.*

**4. Validation des données et hardening API**

- **Schémas de payload** : Introduire un middleware de validation (Zod) appliqué aux routes admin et publiques pour assainir **`req.body`**, **`req.params`**, **`req.query`**.
- **Gestion d’erreurs** : Adapter l’**`errorHandler`** pour renvoyer un format cohérent (message, code, détails), journaliser les violations d’accès ou de validation.