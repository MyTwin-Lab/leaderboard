# Puissance de calcul GPU (Scaleway) pour les challenges ML

**Livrable de cette tâche de planification** : ce contenu sera écrit tel quel dans un nouveau fichier local `docs/superpowers/plans/2026-08-01-ml-compute-power.md`, à l'intérieur du dossier de travail (`E:\OneDrive\Bureau\PROJETS\Leaderboard\leaderboard`). Ce sera un fichier non suivi par git (`??` dans `git status`) tant qu'il n'est pas explicitement ajouté et committé — aucune écriture n'est faite sur le dépôt distant GitHub à aucun moment.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sur les challenges de type ML, permettre à un contributeur de demander une instance GPU temporaire chez Scaleway (validée par le manager du challenge), pré-configurée avec Jupyter accessible depuis le navigateur, coupée automatiquement 24h après approbation.

**Architecture:** Machine à états métier (`compute_requests`) orchestrée par `ComputeRequestService`, qui délègue la brique technique (créer/vérifier/détruire l'instance) au package `packages/provisioner/` existant via un nouveau `ScalewayGpuProvider implements WorkspaceProvider` — même pattern que `GitHubBranchProvider`. Le workflow d'approbation (pending/approved/rejected humains, minuteur 24h) reste hors du provisioner, qui n'est sollicité que pour la ressource technique elle-même. La connexion admin au compte Scaleway suit exactement le pattern des intégrations existantes (Kaggle/GitHub/Slack/OpenAI) sur la table singleton `app_settings`. Deux crons (pattern `sync-meeting`) pollent la création d'instance et coupent les instances expirées.

**Tech Stack:** Next.js 16 (App Router), Drizzle ORM (PostgreSQL), `drizzle-kit generate`, `jose` JWT, React client components, Vercel Cron.

## Global Constraints

- Spec source de vérité : `challenges/challenge-013-ml_compute_power/SPEC.md` — s'y référer pour toute ambiguïté non couverte ici.
- Feature strictement limitée aux challenges `type === 'ml'` — invisible pour `code` et `validation`.
- Une seule demande par `(challenge_id, user_id)`, contrainte unique en DB, pas seulement applicative.
- Le manager ne voit **jamais** le jeton d'accès à l'instance (`access_token_enc/iv` exclus des colonnes "résumé" retournées aux routes manager).
- Le jeton est consultable tant que l'instance est `ready` (pas de burn-after-read strict — décision produit validée).
- Déconnexion Scaleway par l'admin = déconnexion douce : le secret reste utilisable en interne tant qu'il existe une demande active (`approved|provisioning|ready`) quelque part, purgé automatiquement sinon par le cron.
- Statut `failed` distinct de `rejected` ; le manager peut relancer (`retry`) une demande `failed` sans créer de nouvelle ligne.
- `packages/provisioner/` : un seul changement d'interface (`ProvisionResult.secret?: string`), tout le reste s'utilise tel quel (`provision`, `getStatus`, `deprovision`). `protect()` non implémenté pour ce provider.
- Le provider Scaleway est construit et enregistré dynamiquement à chaque usage (pas au boot comme `GitHubBranchProvider`), car ses credentials viennent de la DB (`app_settings`), pas d'une variable d'environnement statique.
- Toutes les nouvelles routes API suivent le pattern JWT-cookie déjà utilisé par `ml-workspace/route.ts` (`getSession()` local via `jwtVerify`) et `isManagerOfChallenge` (`@/lib/server/managerAuth.ts`) pour les routes manager.
- Générer les migrations via `npm run db:generate` — ne jamais écrire le SQL de migration à la main.

---

## Section 1 — DB & Data Layer

### Files
- Modify: `packages/database-service/db/drizzle.ts`
- Modify: `packages/database-service/domain/entities.ts`
- Modify: `packages/database-service/domain/schemas_zod.ts`
- Modify: `packages/database-service/db/mappers.ts`
- Modify: `packages/database-service/repositories/appSettings.repo.ts`
- Create: `packages/database-service/repositories/computeRequest.repo.ts`
- Modify: `packages/database-service/repositories/index.ts`

### Steps

- [ ] **Step 1: Lire les fichiers à modifier**
  - `drizzle.ts` — repérer le bloc `app_settings` (colonnes `kaggle_*`, ~ligne 623-628) et le bloc `validation_attempts` (~ligne 216) pour l'emplacement de la nouvelle table.
  - `entities.ts` — repérer `AppSettings` (~ligne 407) et un exemple de repository récent (`ValidationAttempt`) pour le style d'interface.
  - `appSettings.repo.ts` — repérer `updateKaggleConnection`/`clearKaggleConnection` (lignes 78-90, 163-171).
  - `validationAttempt.repo.ts` — repérer `ATTEMPT_SUMMARY_COLUMNS` pour le pattern de colonnes "résumé" sans champs sensibles.

- [ ] **Step 2: Étendre `app_settings` dans `drizzle.ts`**

  Ajouter après le bloc Slack (~ligne 639) :
  ```ts
  // Scaleway GPU compute connection
  scaleway_secret_key_enc: text("scaleway_secret_key_enc"),
  scaleway_secret_key_iv: varchar("scaleway_secret_key_iv", { length: 64 }),
  scaleway_project_id: varchar("scaleway_project_id", { length: 64 }),
  scaleway_zone: varchar("scaleway_zone", { length: 32 }),
  scaleway_connected_at: timestamp("scaleway_connected_at"),
  scaleway_connected_by: uuid("scaleway_connected_by").references(() => users.uuid),
  scaleway_disconnect_requested_at: timestamp("scaleway_disconnect_requested_at"),
  ```

- [ ] **Step 3: Créer la table `compute_requests` dans `drizzle.ts`**

  Ajouter après le bloc `validation_attempts` :
  ```ts
  // --- COMPUTE REQUESTS (Scaleway GPU) ---
  export const compute_requests = pgTable("compute_requests", {
    uuid: uuid("uuid").primaryKey().defaultRandom(),
    challenge_id: uuid("challenge_id").references(() => challenges.uuid, { onDelete: "cascade" }).notNull(),
    user_id: uuid("user_id").references(() => users.uuid, { onDelete: "cascade" }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    // 'pending' | 'rejected' | 'approved' | 'provisioning' | 'ready' | 'expired' | 'failed'
    requested_at: timestamp("requested_at").defaultNow().notNull(),
    decided_at: timestamp("decided_at"),
    decided_by: uuid("decided_by").references(() => users.uuid),
    approved_at: timestamp("approved_at"),
    expires_at: timestamp("expires_at"),
    provisioning_started_at: timestamp("provisioning_started_at"),
    ready_at: timestamp("ready_at"),
    expired_at: timestamp("expired_at"),
    expire_reason: varchar("expire_reason", { length: 20 }), // 'timeout' | 'challenge_closed' | 'challenge_deleted'
    failed_at: timestamp("failed_at"),
    error_message: text("error_message"),
    provider_ref: varchar("provider_ref", { length: 128 }),   // ex: "fr-par-2/<serverId>"
    provider_parent_ref: varchar("provider_parent_ref", { length: 128 }), // ex: projectId
    jupyter_base_url: text("jupyter_base_url"),                // sans le token
    access_token_enc: text("access_token_enc"),
    access_token_iv: varchar("access_token_iv", { length: 64 }),
    access_token_revealed_at: timestamp("access_token_revealed_at"),
    updated_at: timestamp("updated_at").defaultNow(),
  }, (table) => ({
    challengeIdIdx: index("idx_compute_requests_challenge_id").on(table.challenge_id),
    statusIdx: index("idx_compute_requests_status").on(table.status),
    uniqueRequestIdx: uniqueIndex("idx_compute_requests_unique").on(table.challenge_id, table.user_id),
  }));
  ```

- [ ] **Step 4: `entities.ts` — ajouter `ComputeRequest` + étendre `AppSettings`**
  ```ts
  export interface ComputeRequest {
    uuid: string;
    challenge_id: string;
    user_id: string;
    status: 'pending' | 'rejected' | 'approved' | 'provisioning' | 'ready' | 'expired' | 'failed';
    requested_at: Date;
    decided_at?: Date;
    decided_by?: string;
    approved_at?: Date;
    expires_at?: Date;
    provisioning_started_at?: Date;
    ready_at?: Date;
    expired_at?: Date;
    expire_reason?: 'timeout' | 'challenge_closed' | 'challenge_deleted';
    failed_at?: Date;
    error_message?: string;
    provider_ref?: string;
    provider_parent_ref?: string;
    jupyter_base_url?: string;
    access_token_enc?: string;
    access_token_iv?: string;
    access_token_revealed_at?: Date;
    updated_at?: Date;
  }
  ```
  Dans `AppSettings`, ajouter : `scaleway_project_id?: string`, `scaleway_zone?: string`, `scaleway_connected_at?: Date`, `scaleway_connected_by?: string`, `scaleway_is_connected: boolean` (dérivé), `scaleway_disconnect_requested_at?: Date`.

- [ ] **Step 5: `schemas_zod.ts` — ajouter `computeRequestSchema`**
  ```ts
  export const computeRequestSchema = z.object({
    uuid: z.string().uuid(),
    challenge_id: z.string().uuid(),
    user_id: z.string().uuid(),
    status: z.enum(['pending', 'rejected', 'approved', 'provisioning', 'ready', 'expired', 'failed']),
    requested_at: z.date(),
    decided_at: z.date().optional(),
    decided_by: z.string().uuid().optional(),
    approved_at: z.date().optional(),
    expires_at: z.date().optional(),
    provisioning_started_at: z.date().optional(),
    ready_at: z.date().optional(),
    expired_at: z.date().optional(),
    expire_reason: z.enum(['timeout', 'challenge_closed', 'challenge_deleted']).optional(),
    failed_at: z.date().optional(),
    error_message: z.string().optional(),
    provider_ref: z.string().optional(),
    provider_parent_ref: z.string().optional(),
    jupyter_base_url: z.string().optional(),
  });
  ```

- [ ] **Step 6: `mappers.ts` — `toDomainComputeRequest`/`toDbComputeRequest` + extension `toDomainAppSettings`**
  - Mapper standard aller-retour pour `compute_requests` (même style que `toDomainValidationAttempt`).
  - Dans `toDomainAppSettings` (~ligne 780) : `scaleway_is_connected: !!row.scaleway_secret_key_enc && !row.scaleway_disconnect_requested_at`.

- [ ] **Step 7: Créer `computeRequest.repo.ts`**

  Colonnes résumé (sans `access_token_enc/iv`), pattern `ATTEMPT_SUMMARY_COLUMNS` :
  ```ts
  const REQUEST_SUMMARY_COLUMNS = {
    uuid: compute_requests.uuid,
    challenge_id: compute_requests.challenge_id,
    user_id: compute_requests.user_id,
    status: compute_requests.status,
    requested_at: compute_requests.requested_at,
    decided_at: compute_requests.decided_at,
    decided_by: compute_requests.decided_by,
    approved_at: compute_requests.approved_at,
    expires_at: compute_requests.expires_at,
    ready_at: compute_requests.ready_at,
    expired_at: compute_requests.expired_at,
    expire_reason: compute_requests.expire_reason,
    error_message: compute_requests.error_message,
    jupyter_base_url: compute_requests.jupyter_base_url,
  };
  ```
  Méthodes : `create` (retourne `null` sur code erreur `23505`, comme `ValidationAttemptRepository`), `findByChallengeAndUser`, `findByChallenge` (résumé), `findById` (ligne complète, usage interne service uniquement), `updateApproved`, `updateRejected`, `updateProvisioningStarted`, `updateReady`, `updateFailed`, `updateExpired`, `markTokenRevealed`, `findProvisioningInProgress()`, `findExpiredPending(now: Date)`, `findActiveForChallenge(challengeId)`, `countActiveGlobally()`.

- [ ] **Step 8: Étendre `appSettings.repo.ts`**
  ```ts
  async updateScalewayConnection(data: {
    scaleway_secret_key_enc: string;
    scaleway_secret_key_iv: string;
    scaleway_project_id: string;
    scaleway_zone: string;
    scaleway_connected_by: string;
  }): Promise<void> { /* miroir updateKaggleConnection, pose aussi scaleway_disconnect_requested_at: null */ }

  async requestScalewayDisconnect(): Promise<void> {
    await db.update(app_settings).set({ scaleway_disconnect_requested_at: new Date() }).where(eq(app_settings.id, 1));
  }

  async purgeScalewaySecretIfSafe(): Promise<void> {
    // Appelée par le cron : ne purge que si scaleway_disconnect_requested_at est posé
    // ET ComputeRequestRepository.countActiveGlobally() === 0
  }
  ```

- [ ] **Step 9: Exporter `ComputeRequestRepository` dans `repositories/index.ts`**

- [ ] **Step 10: Générer la migration**
  ```
  npm run db:generate
  ```
  Vérifier le SQL généré (nouvelle table + colonnes `app_settings`), puis `npm run db:push` en local pour appliquer.

---

## Section 2 — Client Scaleway (bas niveau)

### Files
- Create: `packages/scaleway/types.ts`
- Create: `packages/scaleway/client.ts`
- Create: `packages/scaleway/index.ts`
- Create: `packages/config/scalewayCredentials.ts`

### Steps

- [ ] **Step 1: Lire `packages/config/kaggleCredentials.ts` et `packages/connectors/implementation/Kaggle.connector.ts`** comme référence de style (fetch + auth header + throw si `!res.ok`).

- [ ] **Step 2: `packages/scaleway/types.ts`**
  ```ts
  export type ScalewayServerState = 'running' | 'stopped' | 'starting' | 'stopping' | 'locked' | 'error';

  export interface CreateInstanceParams {
    zone: string;
    projectId: string;
    name: string;
    commercialType: string;   // TODO: confirmer le gabarit exact (L4 pressenti — voir SPEC §9)
    imageId: string;          // TODO: UUID image marketplace GPU/CUDA+Jupyter pour la zone cible
    cloudInitAccessToken: string; // injecté dans le cloud-init pour --NotebookApp.token
  }

  export interface CreateInstanceResult {
    serverId: string;
    zone: string;
    publicIp: string | null;
  }

  export interface InstanceStatus {
    state: ScalewayServerState;
    publicIp: string | null;
  }
  ```

- [ ] **Step 3: `packages/scaleway/client.ts` — `ScalewayClient`**
  ```ts
  export class ScalewayClient {
    constructor(private secretKey: string, private projectId: string) {}

    private async request(zone: string, path: string, init?: RequestInit) {
      const res = await fetch(`https://api.scaleway.com/instance/v1/zones/${zone}${path}`, {
        ...init,
        headers: { 'X-Auth-Token': this.secretKey, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
      });
      if (!res.ok) throw new Error(`Scaleway API error ${res.status}: ${res.statusText} (${path})`);
      return res.status === 204 ? null : res.json();
    }

    async testConnection(zone: string): Promise<boolean> {
      try { await this.request(zone, '/servers?per_page=1'); return true; } catch { return false; }
    }

    async createInstance(params: CreateInstanceParams): Promise<CreateInstanceResult> {
      // TODO: commercial_type / image params à confirmer (SPEC §9)
      const created = await this.request(params.zone, '/servers', {
        method: 'POST',
        body: JSON.stringify({
          project: this.projectId,
          name: params.name,
          commercial_type: params.commercialType,
          image: params.imageId,
          dynamic_ip_required: true,
        }),
      });
      const serverId = created.server.id;
      await this.request(params.zone, `/servers/${serverId}/user_data/cloud-init`, {
        method: 'PATCH',
        body: buildCloudInit(params.cloudInitAccessToken), // installe jupyterlab, lance avec le token
      });
      await this.request(params.zone, `/servers/${serverId}/action`, {
        method: 'POST',
        body: JSON.stringify({ action: 'poweron' }),
      });
      return { serverId, zone: params.zone, publicIp: created.server.public_ip?.address ?? null };
    }

    async getInstance(zone: string, serverId: string): Promise<InstanceStatus> {
      const data = await this.request(zone, `/servers/${serverId}`);
      return { state: data.server.state, publicIp: data.server.public_ip?.address ?? null };
    }

    async terminateInstance(zone: string, serverId: string): Promise<void> {
      await this.request(zone, `/servers/${serverId}/action`, {
        method: 'POST', body: JSON.stringify({ action: 'terminate' }),
      });
    }
  }
  ```
  > Note : "instance prête" = état `running` **et** sonde HTTP best-effort sur le port Jupyter (ou délai de grâce fixe configurable si la sonde échoue systématiquement) — le state Scaleway seul ne garantit pas que le cloud-init a terminé. À affiner en implémentation (`pollProvisioning` en Section 4).

- [ ] **Step 4: `packages/scaleway/index.ts`** — barrel export des types + `ScalewayClient`.

- [ ] **Step 5: `packages/config/scalewayCredentials.ts`**
  ```ts
  export async function getScalewayCredentials(): Promise<{ secretKey: string; projectId: string; zone: string } | null> {
    // lit app_settings, déchiffre via decryptToken (packages/config/githubToken.ts)
    // ignore scaleway_disconnect_requested_at — usage interne (cron, deprovision d'une instance déjà active)
  }

  export async function isScalewayUserFacingConnected(): Promise<boolean> {
    // respecte scaleway_disconnect_requested_at — usage: gates de nouvelle demande/approbation, statut UI
  }
  ```

---

## Section 3 — Extension du provisioner

### Files
- Modify: `packages/provisioner/src/types.ts`
- Create: `packages/provisioner/src/providers/scaleway-gpu.provider.ts`
- Modify: `packages/provisioner/README.md`

### Steps

- [ ] **Step 1: Lire `packages/provisioner/src/providers/github-branch.provider.ts` en entier** (déjà fait en phase de conception — le nouveau provider doit avoir la même forme : classe implémentant `WorkspaceProvider`, `provision`/`getStatus`/`deprovision`, erreurs typées de `../errors.js`).

- [ ] **Step 2: `types.ts` — ajouter le champ `secret` à `ProvisionResult`**
  ```ts
  export interface ProvisionResult {
    provider: string;
    workspaceType: WorkspaceType;
    ref: string;
    url: string;
    status: WorkspaceStatus;
    meta?: Record<string, unknown>;
    error?: string;
    /** Secret nécessaire pour accéder au workspace (ex: jeton d'instance). Ne jamais logger ni exposer à un rôle non autorisé. */
    secret?: string;
  }
  ```

- [ ] **Step 3: Créer `scaleway-gpu.provider.ts`**
  ```ts
  import { ScalewayClient } from '../../../scaleway/index.js';
  import type { WorkspaceProvider, ProvisionRequest, ProvisionResult, WorkspaceStatus } from '../types.js';
  import { ProviderAuthenticationError, MissingConfigurationError } from '../errors.js';
  import crypto from 'node:crypto';

  export interface ScalewayGpuCredentials {
    secretKey: string;
    projectId: string;
    zone: string;
  }

  export class ScalewayGpuProvider implements WorkspaceProvider {
    readonly type = 'gpu_instance' as const;
    readonly name = 'Scaleway GPU';
    private client: ScalewayClient;

    // Contrairement à GitHubBranchProvider, les credentials viennent de la DB
    // (app_settings), pas d'une variable d'environnement statique — le
    // constructeur les reçoit explicitement plutôt que de les lire dans
    // process.env, et l'appelant est responsable de reconstruire ce provider
    // à chaque usage (voir Section 4, getScalewayProvider()).
    constructor(private credentials: ScalewayGpuCredentials) {
      if (!credentials?.secretKey) throw new MissingConfigurationError('scaleway_secret_key');
      this.client = new ScalewayClient(credentials.secretKey, credentials.projectId);
    }

    async provision(request: ProvisionRequest): Promise<ProvisionResult> {
      const accessToken = crypto.randomBytes(24).toString('hex');
      try {
        const { serverId, zone, publicIp } = await this.client.createInstance({
          zone: this.credentials.zone,
          projectId: this.credentials.projectId,
          name: request.name,
          commercialType: (request.options?.commercialType as string) ?? 'L4-1-24G', // TODO confirmer SPEC §9
          imageId: (request.options?.imageId as string) ?? '', // TODO UUID image marketplace
          cloudInitAccessToken: accessToken,
        });
        return {
          provider: this.name,
          workspaceType: this.type,
          ref: `${zone}/${serverId}`,
          url: publicIp ? `http://${publicIp}:8888` : '',
          status: 'pending', // création async — la readiness réelle est confirmée via getStatus()
          secret: accessToken,
          meta: { zone, serverId },
        };
      } catch (error: any) {
        if (error.message?.includes('401') || error.message?.includes('403')) {
          throw new ProviderAuthenticationError(this.name, error.message);
        }
        return { provider: this.name, workspaceType: this.type, ref: '', url: '', status: 'failed', error: error.message };
      }
    }

    async getStatus(_parentRef: string, ref: string): Promise<WorkspaceStatus> {
      const [zone, serverId] = ref.split('/');
      try {
        const { state } = await this.client.getInstance(zone, serverId);
        if (state === 'running') return 'ready'; // + sonde Jupyter best-effort, voir Section 4
        if (state === 'error') return 'failed';
        return 'pending';
      } catch { return 'failed'; }
    }

    async deprovision(_parentRef: string, ref: string): Promise<void> {
      const [zone, serverId] = ref.split('/');
      await this.client.terminateInstance(zone, serverId);
    }
  }
  ```

- [ ] **Step 4: `README.md` du package** — ajouter `ScalewayGpuProvider` dans le tableau des providers et une note sur le pattern d'enregistrement dynamique (par opposition au `if (process.env.X) register()` statique au boot).

---

## Section 4 — Service métier + cron

### Files
- Create: `packages/services/compute/compute-request.service.ts`
- Create: `packages/services/compute/scaleway-provider.helper.ts`
- Create: `packages/services/compute/cron-check-provisioning.ts`
- Create: `packages/services/compute/cron-expire-instances.ts`

### Steps

- [ ] **Step 1: Lire `packages/services/sync-meeting/cron-check-meetings.ts` en entier** comme référence de forme (fenêtre 24h, polling externe, fire-and-forget).

- [ ] **Step 2: `scaleway-provider.helper.ts` — enregistrement dynamique**
  ```ts
  import { ProvisionerRegistry } from '../../provisioner/src/index.js';
  import { ScalewayGpuProvider } from '../../provisioner/src/providers/scaleway-gpu.provider.js';
  import { getScalewayCredentials } from '../../config/scalewayCredentials.js';

  // Contrairement à GitHubBranchProvider (enregistré une fois au boot depuis
  // process.env), les credentials Scaleway sont en DB et mutables à chaud —
  // on reconstruit et ré-enregistre le provider avant chaque usage plutôt
  // que de dépendre d'un état "initialized" figé au démarrage du process
  // (fragile en environnement serverless avec cold starts).
  export async function getScalewayProvider(): Promise<ScalewayGpuProvider | null> {
    const creds = await getScalewayCredentials();
    if (!creds) return null;
    const provider = new ScalewayGpuProvider(creds);
    ProvisionerRegistry.register(provider);
    return provider;
  }
  ```

- [ ] **Step 3: `compute-request.service.ts` — `ComputeRequestService`**

  Méthodes (signatures + logique clé) :
  ```ts
  requestCompute(challengeId: string, userId: string): Promise<ComputeRequest | { error: string }>
  // vérifie challenge.type === 'ml', isScalewayUserFacingConnected(), garantit le
  // membership ChallengeTeam (même logique que ml-workspace/route.ts L.101-107),
  // repo.create() — retourne { error: 'already_requested' } si create() renvoie null

  decide(requestId: string, deciderId: string, decision: 'approve' | 'reject'): Promise<ComputeRequest>
  // exige status === 'pending' (throw sinon) ; reject → updateRejected (terminal) ;
  // approve → updateApproved (approved_at, expires_at = approved_at + 24h) puis
  // this.startProvisioning(requestId).catch(err => repo.updateFailed(requestId, err.message))
  // en fire-and-forget — ne pas attendre cette promesse avant de retourner

  startProvisioning(requestId: string): Promise<void>
  // status='provisioning', provider = await getScalewayProvider() (null → updateFailed
  // 'Scaleway non connecté'), provider.provision({ workspaceType: 'gpu_instance',
  // parentRef: creds.projectId, name: `gpu-${challengeId.slice(0,8)}-${userId.slice(0,8)}` }),
  // stocke provider_ref/provider_parent_ref, chiffre et stocke result.secret

  retryProvisioning(requestId: string): Promise<void>
  // même chemin que startProvisioning, appelable uniquement si status === 'failed'

  pollProvisioning(): Promise<void>
  // pour chaque repo.findProvisioningInProgress() : provider.getStatus(parentRef, ref) ;
  // 'ready' → updateReady (construit jupyter_base_url depuis provider meta) ;
  // 'failed' → updateFailed

  sweepExpired(): Promise<void>
  // pour chaque repo.findExpiredPending(now) (status='ready' AND expires_at <= now) :
  // best-effort provider.deprovision(...).catch(log) PUIS, indépendamment du résultat,
  // repo.updateExpired(id, 'timeout') — la coupure ne doit jamais rester bloquée par
  // une erreur d'API externe

  terminateForChallenge(challengeId: string, reason: 'challenge_closed' | 'challenge_deleted'): Promise<void>
  // pour chaque repo.findActiveForChallenge(challengeId) : best-effort deprovision +
  // updateExpired(id, reason)

  revealToken(requestId: string, userId: string): Promise<{ token: string; jupyterUrl: string }>
  // vérifie owner + status === 'ready', déchiffre access_token_enc, marque
  // access_token_revealed_at (informatif seulement, pas de burn-after-read)
  ```

- [ ] **Step 4: `cron-check-provisioning.ts`**
  ```ts
  export async function checkComputeProvisioning(): Promise<void> {
    await new ComputeRequestService().pollProvisioning();
  }
  ```

- [ ] **Step 5: `cron-expire-instances.ts`**
  ```ts
  export async function expireComputeInstances(): Promise<void> {
    const svc = new ComputeRequestService();
    await svc.sweepExpired();
    await new AppSettingsRepository().purgeScalewaySecretIfSafe();
  }
  ```

---

## Section 5 — Endpoints API

### Files
- Create: `apps/leaderboard-client/src/app/api/scaleway/connection/route.ts`
- Create: `apps/leaderboard-client/src/app/api/scaleway/status/route.ts`
- Create: `apps/leaderboard-client/src/app/api/challenges/[id]/compute-request/route.ts`
- Create: `apps/leaderboard-client/src/app/api/challenges/[id]/compute-request/reveal-token/route.ts`
- Create: `apps/leaderboard-client/src/app/api/challenges/[id]/compute-requests/route.ts`
- Create: `apps/leaderboard-client/src/app/api/challenges/[id]/compute-requests/[requestId]/decision/route.ts`
- Create: `apps/leaderboard-client/src/app/api/cron/compute-provisioning/route.ts`
- Create: `apps/leaderboard-client/src/app/api/cron/compute-expiration/route.ts`

### Steps

- [ ] **Step 1: Lire en entier `api/kaggle/connection/route.ts`, `api/kaggle/status/route.ts`, `api/challenges/[id]/ml-workspace/route.ts`, et `api/cron/check-meetings/route.ts`** comme références directes de style pour chaque route à créer ci-dessous.

- [ ] **Step 2: `api/scaleway/connection/route.ts`** — `POST` (admin only) : valide `{secret_key, project_id, zone}`, `new ScalewayClient(...).testConnection(zone)`, si `false` → 400, sinon chiffre + `appSettingsRepo.updateScalewayConnection(...)`. `DELETE` (admin only) : `appSettingsRepo.requestScalewayDisconnect()` (déconnexion douce, pas de purge immédiate).

- [ ] **Step 3: `api/scaleway/status/route.ts`** — `GET` : retourne `{connected, project_id, connected_at}` depuis `appSettings.scaleway_is_connected`.

- [ ] **Step 4: `api/challenges/[id]/compute-request/route.ts`** — `GET` : `computeRequestRepo.findByChallengeAndUser(challengeId, session.userId)`, résumé sans token. `POST` : `computeRequestService.requestCompute(challengeId, session.userId)`, 409 si `error: 'already_requested'`.

- [ ] **Step 5: `api/challenges/[id]/compute-request/reveal-token/route.ts`** — `POST` : vérifie propriétaire de la demande, `computeRequestService.revealToken(requestId, session.userId)`.

- [ ] **Step 6: `api/challenges/[id]/compute-requests/route.ts`** — `GET` (manager/admin, `isManagerOfChallenge` ou `role==='admin'`) : `computeRequestRepo.findByChallenge(challengeId)`, résumé (jamais le token).

- [ ] **Step 7: `api/challenges/[id]/compute-requests/[requestId]/decision/route.ts`** — `POST` (manager/admin) : body `{decision: 'approve'|'reject'|'retry'}`, `approve`/`reject` → `computeRequestService.decide(...)`, `retry` → `computeRequestService.retryProvisioning(...)` (uniquement si `status==='failed'`).

- [ ] **Step 8: `api/cron/compute-provisioning/route.ts` et `api/cron/compute-expiration/route.ts`** — `GET`, vérifient `Authorization: Bearer ${process.env.CRON_SECRET}` (même garde que `api/cron/check-meetings/route.ts`), délèguent respectivement à `checkComputeProvisioning()` / `expireComputeInstances()`.

---

## Section 6 — Hooks sur la route challenge existante

### Files
- Modify: `apps/leaderboard-client/src/app/api/challenges/[id]/route.ts`

### Steps

- [ ] **Step 1: Lire le fichier en entier**, repérer le handler `PUT` (ligne ~51) et son hook existant `before?.type === 'validation' && before.status !== 'archived' && validated.status === 'archived'` (ligne ~82), et le handler `DELETE` (ligne ~108).

- [ ] **Step 2: Étendre `PUT`** — juste après le hook validation existant, ajouter :
  ```ts
  const wasOpen = !['completed', 'archived'].includes(before?.status ?? '');
  const isNowClosed = ['completed', 'archived'].includes(validated.status ?? '');
  if (before?.type === 'ml' && wasOpen && isNowClosed) {
    const { ComputeRequestService } = await import('../../../../../../../packages/services/compute/compute-request.service');
    new ComputeRequestService().terminateForChallenge(id, 'challenge_closed').catch(err => console.error('terminateForChallenge failed', err));
  }
  ```
  (mêmes ensembles de statuts `['completed','archived']` que `ChallengeManageView.isOpen`, pour rester cohérent avec ce que l'UI appelle déjà "clôturé")

- [ ] **Step 3: Étendre `DELETE`** — **avant** l'appel à `challengeRepo.delete(id)` (les FK `compute_requests.challenge_id` sont en cascade, donc supprimer le challenge d'abord ferait disparaître les lignes avant de pouvoir couper les instances réelles) :
  ```ts
  const { ComputeRequestService } = await import('../../../../../../packages/services/compute/compute-request.service');
  await new ComputeRequestService().terminateForChallenge(id, 'challenge_deleted');
  ```

---

## Section 7 — Cron config

### Files
- Modify: `vercel.json`

### Steps

- [ ] **Step 1: Ajouter au tableau `crons`**
  ```json
  { "path": "/api/cron/compute-provisioning", "schedule": "*/1 * * * *" },
  { "path": "/api/cron/compute-expiration", "schedule": "*/1 * * * *" }
  ```

---

## Section 8 — UI admin : carte de connexion Scaleway

### Files
- Create: `apps/leaderboard-client/src/components/contributor/ScalewayConnectionCard.tsx`
- Modify: `apps/leaderboard-client/src/app/contributors/me/page.tsx`

### Steps

- [ ] **Step 1: Lire `KaggleConnectionCard.tsx` en entier** (déjà fait en conception — squelette à copier 1:1).

- [ ] **Step 2: Créer `ScalewayConnectionCard.tsx`** — même structure que `KaggleConnectionCard.tsx` : `useEffect` fetch `/api/scaleway/status`, formulaire (`secret_key` password, `project_id` text, `zone` text avec valeur suggérée) si déconnecté, badge "Connected" + bouton Disconnect sinon, save via `POST /api/scaleway/connection`.

- [ ] **Step 3: Monter dans `contributors/me/page.tsx`** — ajouter `<ScalewayConnectionCard />` dans la grille "Integrations" (~ligne 113-118), à côté de `<KaggleConnectionCard />`.

---

## Section 9 — UI manager : onglet + panel

### Files
- Modify: `apps/leaderboard-client/src/components/challenges/ChallengeManageView.tsx`
- Create: `apps/leaderboard-client/src/components/challenges/ComputeRequestsPanel.tsx`

### Steps

- [ ] **Step 1: Lire `ValidationRunsPanel.tsx` en entier** (déjà fait en conception — squelette de fetch-on-open à copier, en y ajoutant les actions).

- [ ] **Step 2: `ChallengeManageView.tsx`** — ajouter un state `computeEnabled` peuplé depuis `/api/scaleway/status` dans le `Promise.all` de bootstrap existant (~ligne 853, à côté de `meetingsEnabled`). Dans le bloc `tabs = isML ? [...]` (lignes 878-894), ajouter conditionnellement :
  ```ts
  ...(computeEnabled ? [{
    label: 'Compute',
    panel: <ComputeRequestsPanel challengeId={challengeId} open />,
  }] : []),
  ```
  (onglet totalement absent si Scaleway n'est pas connecté, pas juste vide)

- [ ] **Step 3: Créer `ComputeRequestsPanel.tsx`** — fetch au premier `open` via `useRef` (pattern `ValidationRunsPanel`) sur `GET .../compute-requests`, liste avec `Badge` de statut (`components/ui/Badge.tsx`), boutons Approuver/Refuser (si `pending`) et Réessayer (si `failed`) appelant `POST .../decision`, polling `setInterval` 5-10s tant qu'une ligne est non terminale (§4.3.4 de la SPEC : "le manager voit le statut évoluer en direct").

---

## Section 10 — UI contributeur : bouton + badge

### Files
- Create: `apps/leaderboard-client/src/components/challenges/ComputeRequestPanel.tsx`
- Modify: `apps/leaderboard-client/src/components/challenges/MLChallengeFlow.tsx`

### Steps

- [ ] **Step 1: Lire `MLChallengeFlow.tsx` en entier** pour choisir l'emplacement exact du nouveau panneau dans le flow existant (zone d'entrée du dataset/modèle, avant ou après le bloc "endpoint").

- [ ] **Step 2: Créer `ComputeRequestPanel.tsx`** :
  - fetch `/api/scaleway/status` → si non connecté, message explicatif au lieu du bouton (seul endroit où on affiche un message plutôt que de masquer silencieusement — exigé par SPEC §4.1.4) ; si connecté, fetch `/api/challenges/[id]/compute-request`.
  - Vide → bouton "Demander de la puissance de calcul" + confirmation inline rappelant les règles (SPEC §4.2.2 : 1 seule demande, 24h, coupure automatique).
  - `Badge` par statut : `pending`→"En attente de validation", `approved`→"Approuvée — création en cours", `provisioning`→"Préparation de votre environnement...", `ready`→"Disponible — expire dans XhYY" + bouton "Ouvrir mon environnement" (`POST reveal-token` puis `window.open(jupyterUrl + '?token=' + token)`), `rejected`→"Refusée", `expired`→"Expirée", `failed`→"Échec de la création, contactez un admin".
  - Polling 5-10s tant que non terminal ; compte à rebours XhYY recalculé côté client depuis `expires_at`.

- [ ] **Step 3: Monter dans `MLChallengeFlow.tsx`** à l'emplacement choisi au Step 1.

---

## Vérification

1. `npm run db:generate` puis `npm run db:push` — vérifier la migration générée.
2. Tests unitaires du service : transitions d'état invalides rejetées, contrainte unique respectée, `sweepExpired` idempotent même si `deprovision` échoue.
3. Test manuel de bout en bout (nécessite des credentials Scaleway de test, ou un mock du `ScalewayClient` pour les étapes de création réelle) :
   - Admin connecte Scaleway (`/contributors/me`) → carte "Connected".
   - Contributeur sur un challenge ML membre → bouton visible dans le ML workspace → demande → badge "En attente".
   - Manager → onglet "Compute" visible → Approuver → statut évolue en direct jusqu'à "Disponible" → jeton révélé → "Ouvrir mon environnement" fonctionne.
   - Challenge non-ML ou contributeur non membre → feature invisible.
   - `expires_at` forcé dans le passé en DB → cron d'expiration coupe l'instance, badge "Expirée" des deux côtés.
   - Clôture du challenge avec demande active → coupure immédiate.
   - Déconnexion Scaleway avec instance active → nouvelle demande bloquée ailleurs, instance existante coupée normalement à échéance.
4. `npm run lint` / typecheck sur les packages touchés (`database-service`, `provisioner`, `scaleway`, `services`, `leaderboard-client`).

### Points TODO explicites à confirmer avant mise en prod (non bloquants pour le développement)
- `commercial_type` / zone / image marketplace Scaleway exacts (SPEC §9).
- Fiabilité de la sonde "instance prête" (état `running` + sonde HTTP Jupyter vs délai de grâce fixe).
