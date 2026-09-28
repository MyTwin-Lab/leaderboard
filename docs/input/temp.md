# MyTwin Lab Leaderboard — Correctifs sécurité, données personnelles et conformité

> Document de travail, non autoritatif. Rédigé le 14/09/2026 à l'issue de l'audit SEO / légal
> (branche `challenge-019-seo-sandbox`). Chaque constat a été vérifié dans le code ; C1 a en plus
> été reproduit sur une instance locale. Les numéros de ligne peuvent avoir glissé de quelques lignes.

## 0. À lire en premier

**Ordre de traitement :** C1 (aujourd'hui) → H5 (rotation du token Grafana) → H1 à H4 → M3 → M5 → le reste.

**Dépendance avec les pages légales.** Les nouvelles pages `/terms-of-use` et `/privacy-policy`
(`apps/leaderboard-client/content/legal/`) décrivent l'état **après** corrections. Les items
marqués 📄 rendent vrai un engagement écrit dans ces pages : ils doivent être livrés **avant ou avec**
la mise en ligne de ces pages. Si un item 📄 est reporté, adapter la phrase correspondante de la
politique au lieu de publier un engagement faux.

**Conventions de chemins**

| Alias | Chemin |
|---|---|
| `APP` | `apps/leaderboard-client/src` |
| `API` | `apps/leaderboard-client/src/app/api` |
| `PKG` | `packages` |

Chaque item suit la même structure : **Constat** (avec preuves), **Exploitable par**, **Impact**, **Correctif**, **Test**.

**Note sur la page challenge :** `APP/app/challenges/[id]/page.tsx` est désormais une coquille serveur
(SSR pour les visiteurs sans cookie). Le code client a été déplacé tel quel dans `ChallengeDetailClient.tsx`.

---

## 1. 🔴 Critique

### C1 — Le cookie anonyme `sb_anon` sert de jeton de session ; `check-session` échoue en mode ouvert

**Constat**

La chaîne complète, étape par étape :

1. `APP/lib/server/anonVisitor.ts:29` et `:67-71` : le cookie `sb_anon` est un JWT `{ aid }` signé avec **le même secret** que les sessions (`config.auth.jwtSecret`).
2. `API/sandboxes/[id]/star/route.ts:57,72` : le cookie est délivré à n'importe quel visiteur sans cookie qui donne une étoile à une sandbox ouverte.
3. `APP/proxy.ts:41-52` (`verifyTokenEdge`) : accepte tout JWT bien signé et renvoie `userId: payload.userId`, qui vaut ici `undefined`.
4. `proxy.ts:117-118` appelle alors `check-session?userId=undefined`.
5. `API/auth/check-session/route.ts:17` : `findById('undefined')` fait planter Postgres (uuid invalide). Faute de try/catch, la route répond 500.
6. `proxy.ts:120` : `if (!res.ok) return true` — l'échec du check laisse passer.
7. Les GET ne sont pas filtrés par rôle (`proxy.ts:328` ne garde que les écritures) : la requête aboutit.

Trois variantes aggravent le problème :

- `APP/lib/auth.ts:49-56` (`verifyToken`) a la même faille. Les handlers qui ne testent que `if (!payload)` laissent donc passer (ex. `API/sync-meetings/route.ts:18`).
- Les routes publiques (`overview`, `repo-activity`, `ml-rewards`) sont hors proxy. `verifyRequestToken` y renvoie `{ aid }`, valeur « truthy », et `overview/route.ts:117` sert alors le payload **complet**.
- Un refresh token (valable 7 jours) est accepté comme access token : même secret, même payload, aucune claim de type (`auth.ts:27-44`).

**Reproduit en local :**
```
PUT /api/sandboxes/<id>/star            → 200 + Set-Cookie: sb_anon=…
GET /api/users                          → 401
GET /api/users  (Cookie: access_token=<valeur de sb_anon>)
                                        → 200, liste des utilisateurs avec email
```

**Exploitable par :** n'importe qui, sans compte. La prod est exposée tant que ce correctif n'est pas déployé.

**Impact :** tous les points H1 à H4, M1 et M2 deviennent anonymes. Sont exposés :

- les utilisateurs (email, `google_user_id`, rôle) ;
- les équipes et les évaluations IA ;
- les meetings (liens Meet) ;
- les métadonnées des récompenses.

Les écritures restent bloquées : le rôle est indéfini, le proxy répond 403.

**Correctif** (aucun impact côté UI)

1. `APP/lib/auth.ts` :
   - `generateAccessToken` ajoute la claim `typ: 'access'`.
   - `generateRefreshToken` ajoute `typ: 'refresh'` et un `jti` aléatoire (voir M5).
   - Créer `verifyAccessToken(token)`, qui exige :
     - `typeof userId === 'string'` au format UUID ;
     - `role ∈ ['admin','contributor','viewer','medical_pro']` ;
     - `typ === 'access'` — tolérer l'absence de `typ` pendant 7 jours de transition. Les contrôles sur `userId` et `role` suffisent déjà à tuer l'exploit `sb_anon`.
   - `verifyToken` et `verifyRequestToken` délèguent à ce helper.
2. `APP/proxy.ts` `verifyTokenEdge` : mêmes contrôles, recopiés en ligne (module Edge, pas d'import possible).
3. Remplacer les `jwtVerify` en ligne par le helper :
   - `API/tasks/route.ts:17` et `API/tasks/[id]/route.ts:17` ;
   - `API/challenges/route.ts:54,85` ;
   - `API/challenges/[id]/workspace/route.ts:25`, `project-evaluation/route.ts:9`, `ml-workspace/route.ts:45` ;
   - `API/contributors/me/tasks/route.ts:15` ;
   - `API/evaluation-runs/route.ts:12`, `[id]/route.ts:12`, `[id]/retry/route.ts:17`.
4. `API/auth/refresh/route.ts:26` : exiger `typ === 'refresh'`.
5. `anonVisitor.ts` : signer et vérifier avec `.setAudience('sb_anon')`, idéalement avec une clé dérivée (`HMAC(jwtSecret, 'sb_anon')`).
6. `check-session/route.ts` : valider l'UUID (sinon 400 + `valid:false`) et entourer la lecture d'un try/catch qui renvoie 503.
7. `proxy.ts:120` : n'échouer ouvert que sur 5xx ou erreur réseau. Un 4xx ou `valid:false` invalide la session.

**Test**

- Tests unitaires de `proxy()` : un jeton `{aid}` ou `typ:'refresh'` placé dans `access_token` → 401 sur `GET /api/users`.
- `verifyRequestToken({aid})` → `null`.
- `GET /api/challenges/<id>/overview` avec un cookie `{aid}` → forme publique.
- `check-session?userId=undefined` → `valid:false`.
- Mettre à jour les assertions de payload dans `API/google-auth/callback/route.test.ts:99-103` et `API/auth/refresh/route.test.ts:80+`.
- Rejouer la reproduction ci-dessus → 401.

---

## 2. 🟠 Élevé

### H1 — 📄 `GET /api/users` et `GET /api/users/[id]` renvoient les comptes complets

**Constat**

- `API/users/route.ts:15-18` : `GET()` sans aucune authentification renvoie `userRepo.findAll()`, lignes complètes.
- `PKG/database-service/db/mappers.ts:216-227` : `toDomainUser` laisse passer `email` et `google_user_id`.
- `API/users/[id]/route.ts:12-20` : le GET n'a pas d'auth, alors que le PATCH (`:35-37`) et le DELETE (`:59-61`) vérifient bien le rôle admin.
- La fuite est déjà signalée dans le code : `API/contributors/search/route.ts:18-22`.

**Exploitable par :** tout utilisateur connecté. Via C1 : tout le monde. L'inscription Google crée automatiquement un compte `contributor`.

**Impact :** récupération de tous les comptes (email, identifiant Google, rôle — ce qui révèle les admins et les medical_pro — et bio).

**Appelants front** (tous des pages admin, aucun n'appelle `GET /api/users/[id]`) :

- `APP/app/admin/users/page.tsx:25` + `components/admin/UserList.tsx:109-122` ;
- `APP/app/admin/page.tsx:183` ;
- `APP/app/admin/projects/page.tsx:31` ;
- `APP/app/admin/contributions/page.tsx:50` ;
- `APP/components/admin/TeamModal.tsx:38`.

**Correctif**

- Dans les deux GET, reprendre le motif de `users/[id]/route.ts:35-37` : `getSessionUser()` (qui relit le rôle en base) → 401 sans session, 403 si le rôle n'est pas admin.
- Ajouter le même contrôle au `POST /api/users` (`route.ts:29`), aujourd'hui protégé seulement par le proxy.
- Aucun changement d'UI.

**Test**

- `API/users/route.test.ts` et `[id]/route.test.ts` : 401 sans session ; 403 pour contributor, viewer et medical_pro ; 200 pour admin.
- Vérifier que les pages admin listées ci-dessus fonctionnent toujours.

### H2 — 📄 `GET /api/challenges/[id]/team` et `/context` renvoient les comptes complets

**Constat**

- `API/challenges/[id]/team/route.ts:12-19` : aucune authentification. La route appelle `findTeamMembers`, qui passe par `toDomainUser` (`challengeTeam.repo.ts:27-37`) et renvoie donc email et `google_user_id`.
- `API/challenges/[id]/context/route.ts:9-17` : aucune authentification. Le service (`challenge-context.service.ts:60-70`) inclut les mêmes membres et toutes les tâches.

**Exploitable par :** tout utilisateur connecté (anonyme via C1), sur n'importe quel challenge, brouillons compris.

**Appelants front**

- `/team` : uniquement `APP/components/admin/TeamModal.tsx:26`, qui utilise `uuid`, `full_name` et `github_username`.
- `/context` : aucun appelant. `PKG/services/webhook.service.ts:222` appelle le service directement, pas la route.

**Correctif**

1. `/team` :
   - authentification ;
   - 403 sauf si l'utilisateur est admin ou `isManagerOfChallenge(userId, id)` (`APP/lib/server/managerAuth.ts:4`) ;
   - chaque membre réduit à `{ uuid, full_name, github_username, avatar_url }`.
2. `/context` : supprimer la route et son test. S'il faut la garder : `verifyAdmin` et même mapping des membres.

**Test**

- viewer → 403 ;
- admin → 200, et `body[0]` ne contient ni `email` ni `google_user_id` ;
- `GET /context` → 404 ;
- la modale Team de l'admin affiche toujours les membres.

### H3 — 📄 `GET /api/challenges/[id]/overview` sert le payload interne brut à toute session

**Constat**

`overview/route.ts:117` renvoie `session ? payload : toPublicOverview(payload)`, sans contrôle d'appartenance ni de rôle. Ce qui fuit, par rapport à ce que l'UI utilise réellement :

| Champ | Fuite | Utilisé par l'UI |
|---|---|---|
| `team` | email, `google_user_id`, rôle, bio | `uuid`, `full_name`, `avatar_url`, `github_username` |
| `contributions[].evaluation` | scores et commentaires IA de tout le monde (contredit la règle « auteur seulement » de `API/contributions/[id]/route.ts:24-27`) | seulement la contribution de l'utilisateur (`CodeChallengePanel.tsx:99`) |
| `meetings` | `meet_link`, `calendar_event_id`, `conference_*`, `created_by` | lien Meet pour les membres (`MeetingsSection.tsx:84`) |
| `participants` | `workspace_url` / `workspace_ref` de chaque participant | sa propre ligne ; `workspace_status` dans la vue manager |
| `tasks` | titres et descriptions des boards personnels des autres (volontairement retirés pour les anonymes dans `APP/lib/public/overview.ts:8-9`) | son board et les templates ; la vue manager utilise tout |
| `repos` | `workspace_meta.userUrls` / `datasetUrls` | `repo_type` seulement |

**Appelants front :** `ChallengeDetailClient.tsx:172-174` et `ChallengeManageView.tsx:428-444`. Les deux partagent la clé de requête `['challenge-overview', id]` : ils doivent fonctionner avec **la même forme** de réponse.

**Correctif**

1. Dans `APP/lib/public/overview.ts`, ajouter `toSignedInOverview(payload, { userId, role, workspaceOwnerId, isMember, privileged })`, construit champ par champ comme `toPublicOverview`. Extraire le mapping d'équipe (`:46-51`) dans `toPublicTeamMember`.
2. Dans la route, calculer :
   - `isMember` : l'utilisateur figure dans `participants` ;
   - `privileged` : admin ou manager du challenge ;
   - `mine` : l'ensemble `{ userId, myWorkspaceOwnerId }`.
3. Règles appliquées à toute session, admins compris :
   - `team` → `{ uuid, full_name, avatar_url, github_username }` ;
   - `contributions[].evaluation` conservée seulement si `mine` contient `c.user_id` ou si l'utilisateur est admin, sinon `null` ;
   - `repos` → `{ repo_id, role, repo_type, repo_title }`.
4. Règles supplémentaires si `privileged` est faux :
   - `tasks` : ligne complète seulement si `user_id` est nul ou dans `mine`, sinon `{ uuid, user_id, status, parent_task_id }` ;
   - `participants` : champs `workspace_*` seulement pour les lignes de `mine` ;
   - `meetings` : si l'utilisateur n'est pas membre, retirer `meet_link`, `calendar_event_id`, `conference_id` et `conference_record_id`, et n'afficher `MeetingsSection` qu'aux membres et admins.
5. Si `privileged` est vrai : `tasks`, `participants` et `meetings` restent entiers.
6. Le prérendu SSR (`APP/lib/server/publicSsr.ts`) appelle la route sans cookie : il n'est pas concerné.

**Test**

- Test unitaire de `toSignedInOverview` avec la fixture RAW de `APP/lib/public/overview.test.ts:6-29` : le JSON ne doit contenir ni email, ni `google_user_id`, ni `workspace_meta`, ni titre de tâche d'un autre contributeur.
- Remplacer le test « leaves the payload whole » (`overview/route.test.ts:112-120`) par quatre cas : non-membre, membre, co-membre de groupe (voit l'évaluation du porteur), admin ou manager.
- Manuel : le board, la branche et le score d'un membre s'affichent toujours ; le statut des workspaces reste visible pour le manager.

### H4 — 📄 `/api/sync-meetings/**` lisible par toute session ; poids IA par personne contraires à la SPEC

**Constat**

- `API/sync-meetings/route.ts:18-35` : seule la présence d'un jeton est vérifiée. Sans `challenge_id`, la route renvoie **tous** les meetings.
- `[id]/route.ts:10-23` : ligne brute (lien Meet, identifiants calendrier et conférence).
- `[id]/participants/route.ts:10-19` : `google_user_id` et `display_name`, y compris pour des personnes sans compte sur la plateforme (`meeting-ingestion.service.ts:45-54`).
- `[id]/analysis/route.ts:10-23` : résumé, décisions, actions, `contribution_signals`.
- Des poids individuels sont bien produits :
  - `PKG/sync-meeting-agent/schemas.ts:16-21` : `weight` entre 0 et 1 par participant ;
  - prompt `prompts.ts:41,50` : « For each participant, identify their contribution type and weight » ;
  - affichés par personne dans `APP/app/sync-meetings/[id]/page.tsx:402-422`.
- Or `challenges/challenge-008-sync_agent/SPEC.md:163-168` (§9) stipule « **Aucune utilisation à des fins d'évaluation individuelle** » et un opt-in explicite, qui n'a jamais été implémenté.

**Exploitable par :** toute session (anonyme via C1) : un appel à la liste, puis un appel par identifiant.

**Appelants front**

- Admin : `APP/app/admin/page.tsx:186`, `admin/meetings/page.tsx:30`, `components/admin/ParticipantsModal.tsx:23`.
- `APP/app/sync-meetings/[id]/page.tsx:138,144,150`, ouverte depuis `ChallengeDetailClient.tsx:616` et `ChallengeManageView.tsx:795`.
- Aucun appelant n'utilise `?challenge_id`.

**Correctif**

1. Ajouter à `APP/lib/server/managerAuth.ts` :
   ```ts
   export async function canAccessChallengeInternals(user: { id: string; role: string }, challengeId: string) {
     if (user.role === 'admin') return true;
     if (await isManagerOfChallenge(user.id, challengeId)) return true;
     return !!(await repositories.challengeTeam.findByChallengeAndUser(challengeId, user.id));
   }
   ```
2. Liste :
   - sans `challenge_id` : admin uniquement (403 sinon) ;
   - avec `challenge_id` : `canAccessChallengeInternals` requis.
3. `[id]`, `participants` et `analysis` : charger le meeting, puis renvoyer 404 s'il est absent ou si l'accès est refusé. Ensuite, réponses en liste blanche :
   - `[id]` → `uuid, title, description, challenge_id, start_time, end_time, meet_link, status, created_by` ;
   - `participants` (non-admin) → `{ uuid, user_id, display_name }` ; `google_user_id` réservé aux admins ;
   - `analysis` (non-admin) → `{ summary, decisions, actions, status, processed_at }`.
4. SPEC §9 :
   - retirer `weight` et `contribution_signals` de `prompts.ts:41-58` et `schemas.ts:16-27` ;
   - retirer le bloc d'affichage `sync-meetings/[id]/page.tsx:402-444`.

   La politique de confidentialité parle de « the contributions mentioned », pas de scores individuels. Si le produit veut garder ces poids : les réserver aux admins, documenter la décision et adapter la politique.
5. Se coordonner avec H3 sur le champ `meetings` de l'overview.

**Test**

Étendre `API/sync-meetings/route.test.ts` et les trois fichiers de test `[id]` :

- viewer non-membre → 404 ;
- membre → 200, sans `google_user_id` ni `contribution_signals` ;
- admin → données complètes ;
- liste sans filtre par un non-admin → 403.

### H5 — Credential Grafana Cloud en dur dans git ; traces envoyées en prod depuis tout environnement, `?code=` OAuth compris

**Constat**

- `APP/lib/otel.ts:15` : endpoint en dur (la version par variable d'environnement est commentée ligne 14).
- `otel.ts:40-42` : en-tête `Authorization: Basic …` en clair dans le code (valeur volontairement non reproduite ici). Le parsing des en-têtes par variable d'environnement (`:22-31`) est du code mort.
- Commité dans `53f022c` (16/03/2026) : présent sur `origin/main` et plusieurs branches.
- `otel.ts:48,51` : service `'my-app'` et `deployment.environment: 'production'` en dur.
- `APP/instrumentation.ts:1-6` : le seul garde est `NEXT_RUNTIME === 'nodejs'`, vrai aussi en `next dev`. Les runs locaux envoient donc des traces étiquetées « production ».
- `otel.ts:55` : `HttpInstrumentation` sans option, qui enregistre l'URL complète des requêtes entrantes. Partent ainsi dans Grafana :
  - `/api/google-auth/callback?code=…&state=…` ;
  - `/api/github-oauth/callback?code=…` ;
  - `check-session?userId=…` ;
  - les jetons d'invitation de groupe présents dans le chemin ;
  - l'IP et le user-agent.
- `SimpleSpanProcessor` : un export HTTP par span. `FetchInstrumentation` : paquet navigateur, sans effet côté Node.

**Exploitable par :** quiconque a un accès en lecture au repo (usage du token) ou à Grafana (lecture des codes OAuth).

**Correctif**

1. **Aujourd'hui :** révoquer et régénérer le token d'access policy Grafana. Réécrire l'historique git est optionnel ; c'est la rotation qui compte.
2. `otel.ts` :
   - utiliser `process.env.OTEL_EXPORTER_OTLP_ENDPOINT` et le parser d'en-têtes existant (supprimer `:38-43`, restaurer `:33-36`) ;
   - nom de service lu dans `OTEL_SERVICE_NAME` ;
   - `deployment.environment` lu dans `OTEL_DEPLOYMENT_ENVIRONMENT ?? NODE_ENV`.
3. `instrumentation.ts` : sortir tout de suite si `OTEL_EXPORTER_OTLP_ENDPOINT` n'est pas défini. En local, plus rien n'est envoyé.
4. Passer à `BatchSpanProcessor` et retirer `FetchInstrumentation`.
5. Enregistrer en premier un span processor dont `onStart` supprime la query string de `http.target`, `http.url`, `url.full` et `url.query`. Ajouter `new HttpInstrumentation({ ignoreIncomingRequestHook: r => r.url?.startsWith('/_next/') ?? false })`.
6. Définir `OTEL_EXPORTER_OTLP_ENDPOINT` et `OTEL_EXPORTER_OTLP_HEADERS` sur Scalingo.
7. 📄 Vérifier la rétention des traces côté Grafana et des logs côté Scalingo : la politique annonce **12 mois maximum** (voir P4).

**Test**

- Test unitaire du processor : `http.target=/api/google-auth/callback?code=x` se termine sans `code=`.
- En local sans la variable : aucun log `[OTel] Tracing enabled`.
- Après déploiement : rechercher `code=` dans les traces Grafana.

---

## 3. 🟡 Moyen

### M1 — 📄 `GET /api/contributions` et `GET /api/contributions/challenge/[id]` renvoient les évaluations IA privées de tout le monde

**Constat**

- `API/contributions/route.ts:8-11` et `API/contributions/challenge/[id]/route.ts:9-20` : aucune authentification, toutes les colonnes renvoyées, `evaluation` comprise.
- La règle « auteur seulement » est pourtant écrite dans `API/contributions/[id]/route.ts:10-12,24-27` et `APP/lib/server/leaderboard.ts:150`.

**Appelants :** admin uniquement (`APP/app/admin/page.tsx:184`, `admin/contributions/page.tsx:36-37`, qui lit `evaluation.globalScore`).

**Correctif :** dans les deux GET, `getSessionUser()` → 401 sans session, 403 si non-admin. Le payload admin ne change pas.

**Test :** contributor → 403 ; admin → 200 avec `evaluation`.

### M2 — 📄 `GET /api/contributions/[id]/rewards` renvoie `reward_entries.meta` (extraits Slack, justifications IA)

**Constat**

- `rewards/route.ts:29-41` : aucun contrôle d'accès, et `:67` renvoie `meta: e.meta ?? null`.
- Pour les signaux Slack, `meta` contient un extrait de message (200 caractères) et la justification rédigée par le LLM à propos de la personne (`slack-signals.service.ts:193-200`).
- Pour le ML, il contient `agentScore` (`ml-reward.ts:156,189,195`).

**Appelants :** `ContributionRewardBreakdown.tsx:68` déclare `meta` mais ne le lit jamais ; `ContributionForm.tsx:33-37` n'utilise que `entries.length`. Des non-auteurs utilisent légitimement cette route : **ne pas** ajouter de contrôle de propriété.

**Correctif :**
1. Supprimer `meta` de la réponse (`route.ts:67`) et de l'interface `ContributionRewardBreakdown.tsx:15`.
2. Optionnel : le renvoyer aux admins uniquement.

**Test :** avec une fixture contenant un extrait, `!('meta' in entries[0])` et le JSON ne contient pas le texte de l'extrait.

### M3 — Open redirect après la connexion Google

**Constat**

- `APP/lib/url.ts:15` (`safeInternalPath`) et `API/google-auth/callback/route.ts:99` utilisent `^\/[a-zA-Z0-9\-_\/]*$`.
- `//1311768467/x` passe cette regex et se résout en `https://78.47.255.147/x`.
- `callback:29` parse `from` depuis `state` sans le revalider.

**Exploitable par :** n'importe qui. Envoyer une victime sur `https://mytwinlab.care/signin?from=//1311768467/phish` : après sa connexion Google, elle atterrit chez l'attaquant.

**Correctif :**
1. `safeInternalPath` : `/^\/(?!\/)[a-zA-Z0-9\-_\/]*$/`.
2. `callback/route.ts:29,99` : try/catch autour du `JSON.parse`, puis `safeInternalPath(from)`.

**Test :** `//1311768467/x`, `///x` et `//localhost` → `/`. Test du callback avec `state {from:'//1311768467'}` → redirection vers `/`.

### M4 — 📄 OAuth Google sans nonce de `state` (CSRF de connexion) ; `verified_email` ignoré

**Constat**

- `API/google-auth/authorize/route.ts:12` : `state = JSON.stringify({ from })`, sans nonce ni cookie.
- `callback/route.ts:22-29` : accepte n'importe quel `code`.
- `google-auth.service.ts:53-57` : ignore `verified_email`.
- `callback:45-52` : écrase `google_user_id` quand l'email correspond.
- `access_type: 'offline'` est inutile.

**Exploitable par :** n'importe qui. La victime est connectée au compte de l'attaquant, et ses étoiles anonymes lui sont rattachées (`callback:91-96`).

**Correctif**

1. Authorize :
   - générer un nonce (`randomBytes(16)`) ;
   - le poser dans un cookie **`g_oauth_state`** (httpOnly, `secure` en prod, lax, 600 s, path `/`). Ce nom est déjà cité dans la politique de confidentialité §9 ;
   - passer `state = JSON.stringify({ nonce, from })`.
2. Callback : exiger `state.nonce === cookie`, puis supprimer le cookie.
3. Refuser la création ou la liaison si `verified_email !== true`. Ne jamais écraser un `google_user_id` différent déjà lié.
4. Retirer `access_type: 'offline'`.

**Test :**
- nonce absent ou différent → redirection d'erreur, aucune recherche d'utilisateur ;
- `verified_email:false` → pas de liaison ;
- `google_user_id` existant différent → non écrasé.

### M5 — Refresh tokens jamais vérifiés en base ; logout et rotation ne révoquent rien ; `cleanupExpired` jamais appelé

**Constat**

- `APP/lib/auth.ts:62` stocke `bcryptHash(token)`. Un hash salé ne peut jamais correspondre à `findByHash` ou `deleteByHash` (`refresh-token.repo.ts:21,35`). De plus, bcrypt ne lit que les 72 premiers octets.
- `API/auth/refresh/route.ts:26,40` : vérifie la signature et l'existence de l'utilisateur, **sans jamais lire la table**.
- Logout (`logout/route.ts:14`) et refresh (`:56`) suppriment des lignes que rien ne lit.
- `cleanupExpired()` (`repo:47`) n'a aucun appelant.

**Exploitable par :** quiconque vole un cookie de refresh. Il reste valide 7 jours, malgré logout et rotation, et sert en plus d'access token (C1).

**Correctif**

1. Ajouter `jti: randomUUID()` au JWT de refresh et stocker `sha256(jti)` en hex dans `token_hash` (au lieu de bcrypt).
2. Refresh :
   - chercher `findByHash(sha256(jti))`, non expiré ;
   - puis `deleteByHash` (usage unique) ;
   - si absent : `deleteAllByUserId(userId)` (détection de réutilisation) et 401.
3. Logout : suppression par hash.
4. Appeler `cleanupExpired()` depuis `API/cron/digest` (quotidien).
5. Effet attendu : toutes les sessions existantes seront déconnectées une fois au déploiement.

**Test :**
- se connecter, garder le cookie de refresh, se déconnecter → `POST /api/auth/refresh` avec ce cookie → 401 ;
- réutiliser un jeton déjà tourné → 401.

### M6 — 📄 Suppression de compte bloquée par des FK sans `onDelete` ; perte des CP des co-membres ; fusion de comptes incomplète

**Constat**

La suppression passe par `DELETE /api/users/[id]` puis `userRepo.delete` ; une erreur de FK remonte en 500 générique.

- **FK vers `users.uuid` sans `onDelete`** (`PKG/database-service/db/drizzle.ts`), qui bloquent en pratique la suppression des admins et managers :
  - `:446` `compute_requests.decided_by` ;
  - `:519` `evaluation_runs.created_by` ;
  - `:558` `evaluation_grids.created_by` ;
  - `:829` `app_settings.updated_by` ;
  - `:835, :841, :846, :852, :861` `app_settings.*_connected_by` ;
  - `:1099` `sync_meetings.created_by`, en plus `notNull`.
- **Supprimer un porteur de groupe** supprime en cascade la contribution de groupe (`:156`) : ses co-membres perdent leurs CP.
- **`meeting_participants`** (`:1115`, set null) conserve `google_user_id` et `display_name`.
- **Digests** : les payloads gardent `full_name` (`PKG/services/digest/digest-payload.ts:87,113,126,149`), et le repository est en insertion seule.
- **Fusion** (`accountMerge.repo.ts`) :
  - le commentaire `:36-41` promet de tout réaffecter, mais `contribution_members`, `notifications`, `validation_case_claims`, `validation_scenario_runs` et `validation_reference_cases.author_user_id` ne le sont pas, et partent en cascade (`:146`) ;
  - `challenge_teams` est mis à jour sans dédoublonnage (`:56`) : sur un challenge commun, violation de `idx_challenge_teams_unique`.

**Correctif**

1. `drizzle.ts` :
   - `{ onDelete: "set null" }` aux lignes 446, 519, 558, 829, 835, 841, 846, 852 et 861 ;
   - ligne 1099 : retirer `.notNull()` et ajouter `set null` ;
   - rendre `SyncMeeting.created_by` nullable dans `domain/entities.ts:486`, `schemas_zod.ts:385` et `mappers.ts:560,578`.
2. `scripts/db-apply-schema.ts` : Postgres n'a pas de `ADD CONSTRAINT IF NOT EXISTS`, d'où un bloc `DO $$` idempotent par couple (table, colonne) :
   - trouver la contrainte via `pg_constraint` jointe à `pg_attribute`, en filtrant `confrelid='users'::regclass AND confdeltype <> 'n'` ;
   - `DROP CONSTRAINT`, puis `ADD CONSTRAINT <t>_<col>_users_uuid_fk … ON DELETE SET NULL` ;
   - ajouter `ALTER TABLE sync_meetings ALTER COLUMN created_by DROP NOT NULL`.
3. Handler DELETE : traduire l'erreur Postgres `23503` en 409, avec le nom de la table.
4. Avant suppression, dans une transaction :
   - transférer les contributions de groupe (et les champs workspace de `challenge_teams`) à un membre restant, ou refuser en 409 ;
   - supprimer ou anonymiser `meeting_participants` par `user_id` ou `google_user_id` ;
   - 📄 remplacer le `full_name` dans les payloads de digest (la politique promet que les données sont supprimées avec le compte).
5. `accountMerge.repo.ts` : réaffecter les 5 tables manquantes, dédoublonner `challenge_teams` et `contribution_members` (en fusionnant `share_cp`), corriger le commentaire.

**Test**

- Admin avec `github_connected_by`, une grille et un meeting → DELETE → 200 et colonnes à NULL.
- `npm run db:apply-schema` lancé deux fois : le second passage ne fait rien.
- Suppression d'un porteur de groupe → le co-membre garde ses CP, ou réponse 409.
- Fusion de deux comptes présents sur le même challenge → succès, parts conservées.

### M7 — 📄 Signaux Slack : noms et emails de non-membres dans les logs ; messages de non-participants envoyés à OpenAI

**Constat**

- `PKG/services/slack/slack-signals.service.ts:103,106` : `console.warn` avec nom **et email** des auteurs non reconnus.
- `:109-117` : tous les messages sont mappés, y compris ceux dont `author_user_id` est nul.
- `prompts.ts:14-17` les rend sous la forme `${author_name} (not a participant): ${text}` et `detect.agent.ts:19-33` les envoie au LLM.
- Or ces messages ne peuvent de toute façon rien rapporter (`prompts.ts:44`, `detect.agent.ts:48,53`).
- Contredit la politique §4.4, qui promet : messages des participants uniquement, email utilisé seulement pour la correspondance.

**Correctif**

1. `:103-106` : ne logger que le nombre d'auteurs non reconnus, ou leurs identifiants Slack.
2. Après `:117` : `llmMessages = messages.filter(m => m.author_user_id)`.
3. `:209` : calculer le curseur sur la liste **non filtrée** (`items[items.length-1].metadata!.ts`).
4. Si `llmMessages` est vide : ne pas appeler `runDetectAgent`, avancer le curseur, renvoyer `no_new_messages`.

**Test :** avec un message de participant et un de non-participant, le prompt ne contient ni le nom ni le texte du second, aucun `console.warn` ne contient d'email, et le curseur avance même quand tous les messages viennent de non-participants.

### M8 — La limite d'étoiles anonymes se contourne en falsifiant `X-Forwarded-For`

**Constat**

- `PKG/services/sandbox/starPolicy.ts:80-85` prend la **première** entrée de XFF.
- Sans cookie, chaque requête reçoit un nouvel `anonId` : la limite par IP (30 par heure) est donc le seul frein.
- Or les paliers d'étoiles rapportent des CP.

À confirmer : exploitable si Scalingo ajoute son entrée à un XFF fourni par le client au lieu de le remplacer.

**Correctif :** `pickClientIp` prend `list[list.length - TRUSTED_PROXY_HOPS]` (par défaut 1, l'entrée ajoutée par le routeur de la plateforme), puis mettre à jour les tests de `starPolicy`.

**Test :**
- `'1.2.3.4, 5.6.7.8'` → `5.6.7.8` ;
- sur staging, la 31ᵉ requête PUT avec un XFF variable → 429.

### M9 — 📄 Token Jupyter des instances GPU : conservé après expiration, transmis en clair, trous dans le balayage

**Constat**

- **Token conservé :** `computeRequest.repo.ts:136-148` (`updateFailed`, `updateExpired`) ne vide jamais `access_token_enc` et `access_token_iv`.
- **Token en clair :** il est injecté via cloud-init (`PKG/scaleway/client.ts:14`) et l'URL Jupyter est en `http://` (`compute-request.service.ts:130`).
- **Trous dans le balayage :**
  - une ligne passe en `expired` même si le déprovisionnement échoue (`:143-151`) ;
  - seules les lignes `ready` sont balayées (`repo:167-172`), jamais `approved` ni `provisioning` ;
  - un `failed` pendant le polling ne détruit pas le serveur.

**Correctif**

1. `updateExpired` et `updateFailed` : mettre aussi `access_token_enc` et `access_token_iv` à `null`.
2. Rattrapage idempotent dans `db-apply-schema.ts` : `UPDATE compute_requests SET access_token_enc=NULL, access_token_iv=NULL WHERE status IN ('expired','failed','rejected') AND access_token_enc IS NOT NULL`.
3. Balayer `status IN ('approved','provisioning','ready')`. Si le déprovisionnement échoue, ne pas marquer la ligne `expired`.
4. Mettre du TLS devant Jupyter, ou au minimum restreindre le security group à l'IP du demandeur.

**Test :** `updateExpired` vide les deux colonnes ; une ligne `provisioning` expirée est bien déprovisionnée.

---

## 4. 🟢 Bas

### L1 — Routes de statut des intégrations sans authentification

**Constat**

| Route | Renvoie |
|---|---|
| `API/kaggle/status` | `username` |
| `API/scaleway/status` | `project_id` |
| `API/slack/status` | `team_name` |
| `API/openai/status` | `connected_at` |

Aucun secret n'est exposé.

**Appelants :** les non-admins n'utilisent que `connected` (`ComputeRequestPanel.tsx:70`, `ChallengeManageView.tsx:478,514`, `ChallengeSlackSignalsEditor.tsx:74-76`).

**Correctif :** `verifyAdmin` ; admin → réponse complète, sinon `{ connected }`.

### L2 — Flags des cookies

**Constat**

- `gh_oauth_state` n'a pas de `secure` (`API/github-oauth/authorize/route.ts:26-31`).
- Les cookies de session passent de `lax` (connexion) à `strict` (refresh), ce qui fait perdre la session sur les liens venant de Slack ou d'un email.
- Le callback GitHub (`callback/route.ts:74-75`) ne vérifie pas le rôle admin.

**Correctif :**
1. Ajouter `secure` en prod à `gh_oauth_state`.
2. Exiger `verifyAdmin` dans le callback GitHub.
3. Créer un helper `sessionCookieOptions(maxAge)` (lax) utilisé par la connexion et le refresh.

### L3 — Email dans le payload du JWT

**Constat :** `APP/lib/auth.ts:17-22` ; l'email est posé dans `callback/route.ts:73-77` et `refresh/route.ts:51`, et n'est jamais lu côté serveur.

**Correctif :** le retirer, puis mettre à jour les tests de payload.

### L4 — Garde SSRF : formes IPv6 manquantes et DNS rebinding

**Constat**

- `PKG/services/challenge/ssrf-guard.ts:56-73` laisse passer `[::]`, `[::7f00:1]` et `[64:ff9b::a9fe:a9fe]` (reproduit).
- Le DNS rebinding reste possible (`:76-81`, où c'est une limite reconnue).
- Les redirections sont en revanche bien gérées (`endpoint-proxy.ts:48-51`).

**Correctif**

1. Bloquer :
   - `::` et `::/96` ;
   - `64:ff9b::/96` (en contrôlant l'IPv4 embarquée) ;
   - `2002::/16` et tout `fe80::/10` ;
   - `224.0.0.0/4` et `240.0.0.0/4`.
2. Épingler la résolution DNS avec un `undici.Agent` dont la fonction `lookup` rejette les IP privées.

**Test :** ajouter ces trois littéraux à `ssrf-guard.test.ts`, plus un resolver factice qui renvoie `127.0.0.1`.

### L5 — Les fetchs internes du proxy font confiance à `X-Forwarded-Host`

**Constat :** `APP/lib/url.ts:28-33` et `proxy.ts:89-92,116-119`. Le refresh token est POSTé vers ce base URL, qui peut donc pointer vers un hôte choisi par l'attaquant.

**Correctif :** construire les URL internes depuis une origine fixe : `process.env.INTERNAL_APP_URL ?? http://127.0.0.1:${PORT}`.

### L6 — Pas de défense CSRF en profondeur ; pas de limite de débit sur les évaluations

**Constat :** aucun contrôle `Origin` ni `Sec-Fetch-Site` nulle part. Le risque est atténué par SameSite. Les évaluations (`project-evaluation`, `sandboxes/[id]/evaluation`) se relancent sans limite, ce qui fait grimper le coût LLM.

**Correctif :**
1. `proxy.ts` : sur les POST, PUT, PATCH et DELETE de l'API, rejeter `Sec-Fetch-Site: cross-site` ou tout `Origin` étranger au site.
2. Marquer une évaluation `running` via un UPDATE conditionnel **avant** de la planifier.

### L7 — Secret des crons comparé avec `!==`

**Correctif :** créer un helper `isCronAuthorized(request)` basé sur `crypto.timingSafeEqual` et l'utiliser dans les 5 routes `API/cron/*`.

### L8 — Rôle medical_pro : aucune validation, aucune trace d'audit

**Constat :** `API/users/[id]/route.ts:8-10` accepte n'importe quelle chaîne comme rôle (`z.string()`).

**Correctif :**
1. `z.enum([...])` dans les deux schémas.
2. Créer une table `role_changes` (`user_id`, `old_role`, `new_role`, `changed_by`, `note`, `created_at`) via `db-apply-schema.ts` et `drizzle.ts`.
3. Y écrire à chaque changement, dans la même transaction.

Côté process : conserver la justification de la qualification déclarée (voir CGU §6).

### L9 — 📄 Pièces des challenges de validation sans durée de conservation

**Constat**

- `purgeContentForChallenge` (`validationAttempt.repo.ts:140-158`) n'est jamais appelé.
- Même appelé, il ne viderait que des colonnes déjà nulles sur les lignes récentes.
- Les vrais octets sont dans :
  - `validation_reference_cases.input_bytes` et `expected_output_bytes` ;
  - `validation_case_claims.response_bytes`.

**Correctif** (la politique annonce **12 mois après la fin du challenge**)

1. Ajouter `purged_at` aux claims et aux cas de référence.
2. Écrire une purge qui met les octets à `''::bytea` et renseigne `purged_at`.
3. L'appeler depuis `API/cron/digest` pour les challenges de validation clos depuis plus de 12 mois.
4. Les routes d'octets renvoient 410 une fois la purge faite.

**Test :** les verdicts et les CP restent intacts après la purge.

### L10 — Snapshots de l'évaluateur jamais nettoyés ; bug `ENAMETOOLONG`

**Constat**

- `PKG/services/challenge/snapshot.service.ts:62-75` écrit le contenu des fichiers dans `os.tmpdir()/eval_agent/…` sans jamais le supprimer. Seul `evaluation-grids/[id]/test-run` nettoie.
- `snapshotId = shas.join("_")` : au-delà d'environ 7 SHA, le nom de dossier dépasse 255 octets et `mkdir` échoue.

**Correctif :**
1. Remplacer par `fs.mkdtemp`.
2. Vérifier que chaque chemin reste confiné au dossier du snapshot.
3. Ajouter une méthode `cleanup(snapshot)`.
4. Envelopper les 3 sites d'appel dans un try/finally : `repo-evaluation.ts:139`, `sync-evaluation.service.ts:137`, `ml-rewards.service.ts:326`.

### L11 — Le leaderboard public et l'accueil exposent aussi les comptes à 0 CP

**Constat**

- `APP/lib/leaderboard.ts:120-124` inclut tous les utilisateurs, et `rankEntries` sort nom, GitHub et bio.
- Le filtre `totalCP > 0` n'est appliqué que côté client : tout est déjà dans le payload RSC.
- L'accueil (`APP/lib/server/home.ts:108,118`) n'applique pas le filtre.

**Correctif :**
1. `fetchLeaderboard` : `rankEntries(aggregated.filter(a => a.totalCP > 0))`.
2. `home.ts` : filtrer `ranked` de la même manière.

Ce correctif fait aussi repasser un test en échec (voir §6).

### L12 — Titres des tâches personnelles lisibles d'un challenge à l'autre

**Constat :** `API/tasks/route.ts:40-60` (`scope=all`), `API/tasks/[id]` et `[id]/details` ne vérifient pas l'appartenance.

**Correctif :** pour les tâches personnelles, exiger `canAccessChallengeInternals` (le helper de H4).

### L13 — 📄 La purge des hash d'IP ne tourne qu'au prochain vote

**Constat :** `sandbox.service.ts:290-296` ne purge qu'au moment d'un vote. Sans activité, les hash dépassent les 30 jours annoncés.

**Correctif :** appeler aussi `purgeIpHashesOlderThan` depuis `API/cron/digest`.

---

## 5. 📄 Engagements de la politique de confidentialité à implémenter

En plus des items 📄 ci-dessus, la politique (`content/legal/privacy-policy.md`) promet les points suivants.

| # | Engagement (section de la politique) | À faire |
|---|---|---|
| P1 | Compte sans connexion depuis **3 ans** supprimé (§4.1) | Colonne `last_login_at` sur `users` (via `db-apply-schema.ts` + `drizzle.ts`), renseignée au callback Google et au refresh. Cron quotidien de suppression via le chemin corrigé en M6. |
| P2 | Résumés de meetings et listes de participants supprimés **12 mois** après la fin du challenge (§4.4) | Purge dans `API/cron/digest` : `meeting_analyses` et `meeting_participants` des challenges `completed` dont `closed_at` a plus de 12 mois. |
| P3 | Pièces des challenges de validation supprimées à **12 mois** (§4.2) | Voir L9. |
| P4 | Logs et traces conservés **12 mois maximum** (§4.5) | Vérifier la rétention des logs Scalingo et des traces Grafana, et la régler si besoin. |
| P5 | Droit d'opposition à l'analyse Slack et meetings : « your messages and meetings will then no longer be analyzed » (§4.4) | Booléen `analysis_opt_out` sur `users`, activable par un admin. Les services Slack et meetings excluent ces personnes : messages non envoyés au LLM, exclues des contributions détectées. |
| P6 | « Team members are informed of it in the challenge » (§4.4) | Texte d'information dans la description des invitations Google Calendar (`sync-meeting.service.ts`) et message épinglé ou topic du canal Slack lié. Afficher aussi une mention dans la page challenge quand Slack ou meetings sont activés. |
| P7 | Changement substantiel des CGU notifié **15 jours** avant (CGU §5) | Mécanisme de bannière in-app avec date d'effet. Optionnel : enregistrer `terms_accepted_version` et `terms_accepted_at` sur `users` à la connexion. |
| P8 | Traitement des demandes RGPD sous **un mois**, revue humaine des évaluations, signalements et contestation DSA (CGU §11) | Process interne : qui lit `contact@my-twin.io`, délai, trace des décisions. Pas de code. |
| P9 | Cookie `g_oauth_state` (§9) | Voir M4. |

---

## 6. Robustesse, hygiène et bugs fonctionnels

### La page challenge plante si Google Workspace n'est pas configuré

`overview/route.ts:73` instancie `new SyncMeetingService()`, dont les services Calendar et Meet lèvent `Google Workspace service account not configured` dans leur constructeur. L'overview renvoie alors 500 et toute la page challenge est cassée : c'est le cas en local, et sur tout environnement sans ces variables.

**Correctif :** lire les meetings via le repository directement, ou instancier les services Google de façon paresseuse, ou try/catch avec `meetings: []`.

### Course à la création d'`app_settings` sur base vierge

Plusieurs lectures simultanées de `appSettingsRepo.get()` tentent d'insérer la ligne `id=1` (`duplicate key app_settings_pkey`).

**Correctif :** `INSERT … ON CONFLICT (id) DO NOTHING`, puis relecture.

### Lockfile de l'app ignoré par git

`apps/leaderboard-client/package.json:26` déclare `@tanstack/react-query`, mais le lockfile local ne le contient pas, et `apps/**/package-lock.json` est ignoré (`.gitignore:33`). Le build de déploiement lance donc `npm install` sans lockfile : il n'est pas reproductible.

**Correctif :**
1. Retirer la ligne d'ignore.
2. Régénérer le lockfile (`npm install` dans l'app) et le commiter.
3. Passer le build en `npm ci`.

### Deux tests en échec sur `main`

- **`API/leaderboard/route.test.ts` › « filters by projectId »** : causé par l'inclusion des comptes à 0 CP. Corrigé par L11.
- **`API/challenges/[id]/repo-activity/route.test.ts` › « returns activities keyed by repo_id with github type »** : le mock utilise `external_repo_id` alors que la route lit `repo_external_id`. Renommer la clé du mock.

### Configuration de déploiement

`scalingo.json` lance encore `db:push` en postdeploy, alors que le `Procfile` lance `db:apply-schema`. Aligner les deux, ou supprimer `scalingo.json`.

### En-têtes de sécurité et réutilisation de clé

- Aucun en-tête HSTS, `X-Content-Type-Options: nosniff`, `Referrer-Policy` ni `frame-ancestors`. Les ajouter dans `next.config.ts`, à côté des `X-Robots-Tag` existants.
- `JWT_SECRET` sert aussi de clé HMAC pour les IP (`APP/lib/server/clientIp.ts:26`). Dériver une clé par usage.

### Bugs fonctionnels trouvés en passant (hors sécurité)

- **Proxy qui bloque des écritures légitimes (403) :** le garde « admin only » n'a pas d'exception pour :
  - `POST /api/challenges/[id]/compute-request` et `/compute-request/reveal-token` (contributeurs) ;
  - `/compute-requests/[requestId]/decision` (managers) ;
  - `POST /api/sync-meetings` (managers, pourtant autorisés par le handler).
- **Détail des récompenses en 401 pour un anonyme :** sur `/contributors/[userId]`, déplier le détail d'une récompense échoue. Après M2, `/api/contributions/[id]/rewards` peut rejoindre `PUBLIC_API_ROUTES` (`APP/lib/routeVisibility.ts`).

### Petits correctifs

- `API/sync-meetings/route.ts:50` logge le corps brut des POST.
- `validation-targets/[targetId]/claim/route.ts:55-61` recopie le `Content-Type` de l'endpoint sans `nosniff`. Utiliser `buildSafeFileHeaders`.
- `user.repo.ts:29` n'échappe pas `%` et `_` dans le `ilike` de recherche.
- Les routes admin « legacy » font confiance au rôle du JWT : kaggle, openai, scaleway et slack `connection`, `sandboxes/[id]/promote`. Préférer `getSessionUser()`, qui relit le rôle en base.
- **SEO mineur :** un brief qui commence par `# Titre` produit un second `<h1>` sur la page challenge. Le renderer `Markdown` pourrait décaler les niveaux de titre dans `ChallengeBrief`.

---

## 7. Conformité non technique (Antoine / relecture juridique)

1. **⚠️ Adresse du siège — à trancher avant la mise en ligne.**
   - D'après l'API officielle recherche-entreprises (INSEE / RNE), le siège de WE ARE ONE (SIREN 953 111 960) est au **10 rue de Penthièvre, 75008 Paris** depuis le **07/02/2026**, et l'établissement d'Issy-les-Moulineaux est fermé.
   - Les nouvelles CGU et la politique du Lab utilisent donc l'adresse de Paris, sans ville de greffe (le RCS dépend normalement du nouveau siège, donc Paris : **à confirmer sur le Kbis**).
   - Côté mytwin.care, les textes légaux (`content/legal/*.md`) et le JSON-LD `LEGAL` de `src/lib/seo.ts` indiquent encore Issy et « RCS Nanterre ». C'est à corriger pour la cohérence NAP de l'entité MyTwin.
2. **Prénom du représentant :** le registre indique « VALCY RUBEN », les textes « Rubens Valcy ». Vérifier l'orthographe légale.
3. **Mentions obligatoires LCEN (art. 6 III)** manquantes dans CGU §1, à ajouter dès qu'elles sont connues :
   - capital social ;
   - numéro de téléphone de l'éditeur ;
   - éventuellement numéro de TVA intracommunautaire.
   Scalingo ne publie pas de téléphone ; son adresse et son site sont indiqués.
4. **DPO :** si We Are One a désigné un DPO auprès de la CNIL, le nommer dans la politique §2. Sinon, garder « contact » (la politique ne parle volontairement pas de DPO).
5. **Version française** des CGU et de la politique : la loi Toubon impose le français pour les contrats avec des consommateurs en France. À décider, sachant que le site est en anglais.
6. **Médiation de la consommation** (Code de la consommation L612-1) : vérifier si l'obligation s'applique à un service gratuit. Si oui, désigner un médiateur et l'ajouter en CGU §17.
7. **Sous-traitants :** s'assurer que les DPA sont acceptés pour OpenAI, Google Workspace, Slack, GitHub, Kaggle, Scaleway, Grafana et Scalingo. Côté OpenAI, envisager la rétention minimale ou nulle des données API.
8. **Registre des traitements (art. 30 RGPD) :** y ajouter les traitements du Lab (compte, évaluation IA, analyse Slack et meetings, étoiles anonymes, logs).
9. **Relecture juridique** des CGU, notamment §8 (licence sur les contributions), §11 (modération DSA), §13 (responsabilité) et l'âge minimum de 18 ans.

---

## 8. Checklist de mise en ligne

- [ ] C1 corrigé et déployé en hotfix
- [ ] Token Grafana révoqué et régénéré (H5)
- [ ] H1, H2, H3, H4, M1, M2 et M7 livrés (la politique §7 et §4.4 deviennent vraies)
- [ ] M4 livré (cookie `g_oauth_state`)
- [ ] P1 à P9 livrés, ou la politique ajustée pour ceux qui sont reportés
- [ ] Points §7.1 à §7.3 tranchés (adresse, prénom, capital, téléphone), CGU mises à jour
- [ ] Branche `challenge-019-seo-sandbox` déployée, puis vérifications de `docs/seo.md` (section « Operating ») en production
- [ ] Search Console : propriété Domaine `mytwinlab.care` et sitemap soumis
