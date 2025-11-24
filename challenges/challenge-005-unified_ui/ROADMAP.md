## **Roadmap de mutualisation Leaderboard/Admin avec accès restreint**

**1. Socle applicatif unifié**

- **Migration backoffice vers Next.js** : Reprendre les écrans admin actuels (**`apps/admin`**) en pages Next.js pour partager le même build, routing et tooling que le leaderboard (déjà sous Next.js).
- **Design system commun** : Créer un kit de composants (layout, tables, formulaires, notifications) pour harmoniser UI/UX et éviter la duplication HTML/CSS.
- **Navigation conditionnelle** : Mettre en place une structure de menu qui masque/affiche dynamiquement les sections admin selon le rôle utilisateur.

**2. Authentification & autorisation robustes**

- **Flux d’auth sécurisé** : Remplacer la Basic Auth locale par un login API + tokens HTTP-only (auth + refresh), suppression du stockage Base64 côté client.
- **Gestion des rôles** : Étendre les entités utilisateurs pour différencier les profils (admin, manager, viewer), exposer ces infos dans les réponses d’auth.
- **Middlewares RBAC** : Sur l’API (**`packages/api/routes/*`**), valider l’accès via un middleware rôle/permissions, et renvoyer des erreurs normalisées 401/403.*

**3. Validation des données et hardening API**

- **Schémas de payload** : Introduire un middleware de validation (Zod) appliqué aux routes admin et publiques pour assainir **`req.body`**, **`req.params`**, **`req.query`**.
- **Gestion d’erreurs** : Adapter l’**`errorHandler`** pour renvoyer un format cohérent (message, code, détails), journaliser les violations d’accès ou de validation.
- **Tests d’intégration** : Étendre la suite **`packages/api/test/*`** pour couvrir les cas d’accès autorisé/interdit et les scénarios de validation.*

**4. Expérience utilisateur et accessibilité**

- **Parcours différenciés** : Afficher clairement le rôle connecté (badge, menu), mettre en place des redirections automatiques si un utilisateur non autorisé tente d’accéder à une section admin.
- **Feedback utilisateur** : Centraliser états de chargement, erreurs et succès via un composant de notifications ; prévoir une logique de logout propre.
- **Accessibilité et responsive** : Vérifier contrastes, navigation clavier, responsive design pour les pages admin et leaderboard.

**5. Ops, déploiement & gouvernance**

- **Mises à jour docs & env** : Mettre à jour README, **`.env.example`**, scripts de démarrage pour refléter la nouvelle auth et les variables nécessaires.
- **CI/CD et observabilité** : Ajuster la pipeline pour build/test le front unifié, surveiller les logs (audit des actions admin, tentatives d’accès refusées).
- **Stratégie de migration** : Planifier une phase de cohabitation avec feature flag, préparer scripts de création/upgrade des comptes, communiquer aux utilisateurs impactés.

Chaque sous-partie représente une contribution autonome, avec livrables identifiables et validations associées.