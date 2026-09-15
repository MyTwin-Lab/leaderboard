import type { Credentials, CredentialStatus } from "../capabilities/credentials.js";

/**
 * IntegrationRegistry
 * -------------------
 * Les connexions aux services tiers qu'un admin établit depuis ses réglages
 * (GitHub, Kaggle, Slack, OpenAI, Scaleway…). Chaque intégration déclare comment
 * elle s'authentifie, comment elle se vérifie auprès du fournisseur et ce
 * qu'elle montre une fois connectée ; le core fournit les routes
 * `/api/integrations/[key]/…`, le store chiffré (`credentials`) et la carte.
 *
 * Les intégrations sont du contenu, enregistré par la distribution installée.
 * L'état vit sur `globalThis`, comme celui des connecteurs.
 */

/** Un champ saisi par l'admin pour une intégration à clé d'API. */
export interface IntegrationField {
  name: string;
  label: string;
  /** Masqué à la saisie. Un seul champ secret est chiffré : celui que `connect` rend comme `secret`. */
  secret?: boolean;
  placeholder?: string;
  defaultValue?: string;
}

export type IntegrationConnectResult =
  | { ok: true; secret: string; meta?: Record<string, unknown> }
  /** `error` : un message affichable (clé d'API) ou un code court (OAuth). */
  | { ok: false; error: string; status?: number };

export interface ApiKeyIntegrationAuth {
  kind: "api_key";
  fields: readonly IntegrationField[];
  /** Vérifie les valeurs auprès du fournisseur avant tout enregistrement. */
  connect(values: Readonly<Record<string, string>>): Promise<IntegrationConnectResult>;
}

export interface OAuthIntegrationAuth {
  kind: "oauth";
  /** L'URL d'autorisation du fournisseur, ou une erreur quand l'OAuth n'est pas configuré. */
  authorize(ctx: { state: string }): { url: string } | { error: string };
  /** Échange le code reçu ; une erreur est un code court, repris dans l'URL de retour. */
  callback(ctx: { code: string | null }): Promise<IntegrationConnectResult>;
}

/** Une ligne affichée sur la carte d'une intégration connectée. */
export interface IntegrationDetail {
  label: string;
  value: string;
}

/** Une lecture annexe d'une intégration (les canaux Slack, par exemple). */
export interface IntegrationExtra {
  key: string;
  /** `admin_or_manager` : un admin, ou le manager d'au moins un projet. */
  access: "admin" | "admin_or_manager";
  run(): Promise<unknown>;
}

export interface IntegrationDefinition {
  key: string;
  label: string;
  /** Sous le nom : « API key connection », « Organization connection »… */
  connectionLabel: string;
  /** Ce que la connexion permet, affiché tant qu'elle n'est pas établie. */
  description: string;
  auth: ApiKeyIntegrationAuth | OAuthIntegrationAuth;
  /** Ce qu'un admin voit d'une connexion établie, tiré de `meta`. Jamais le secret. */
  publicMeta?(meta: Record<string, unknown>): IntegrationDetail[];
  /** Par défaut, une intégration est connectée dès qu'un secret est stocké. */
  isConnected?(status: CredentialStatus): boolean;
  /** Par défaut, la connexion est supprimée du store. */
  disconnect?(credentials: Credentials): Promise<void>;
  extras?: readonly IntegrationExtra[];
}

interface RegistryState {
  byKey: Map<string, IntegrationDefinition>;
}

const STATE_KEY = "__leaderboardIntegrationRegistry";

function state(): RegistryState {
  const holder = globalThis as unknown as Record<string, RegistryState | undefined>;
  holder[STATE_KEY] ??= { byKey: new Map() };
  return holder[STATE_KEY]!;
}

/** L'intégration est connectée, selon sa propre règle. */
export function integrationConnected(definition: IntegrationDefinition, status: CredentialStatus): boolean {
  return definition.isConnected ? definition.isConnected(status) : status.connected;
}

export class IntegrationRegistry {
  /** Une clé déjà prise lève : deux intégrations ne peuvent pas partager un secret. */
  static register(definition: IntegrationDefinition): void {
    const { byKey } = state();
    if (byKey.has(definition.key)) {
      throw new Error(`[IntegrationRegistry] Integration "${definition.key}" is already registered`);
    }
    byKey.set(definition.key, definition);
  }

  static get(key: string): IntegrationDefinition | undefined {
    return state().byKey.get(key);
  }

  /** Dans l'ordre d'enregistrement : celui de la distribution. */
  static list(): IntegrationDefinition[] {
    return [...state().byKey.values()];
  }

  /** Vide le registre — réservé aux tests. */
  static clear(): void {
    state().byKey.clear();
  }
}
