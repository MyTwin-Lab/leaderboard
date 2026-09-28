/**
 * Ce que le client sait d'une intégration (challenge 020, L5)
 * -----------------------------------------------------------
 * La forme renvoyée par `GET /api/integrations` et lue par la carte générique.
 * Sans secret : les champs à saisir, l'état de la connexion et ce qu'un admin
 * peut en voir.
 */

export interface IntegrationFieldView {
  name: string;
  label: string;
  secret?: boolean;
  placeholder?: string;
  defaultValue?: string;
}

export interface IntegrationSummary {
  key: string;
  label: string;
  connectionLabel: string;
  description: string;
  auth: { kind: 'api_key'; fields: IntegrationFieldView[] } | { kind: 'oauth' };
  connected: boolean;
  connected_at: string | null;
  details: Array<{ label: string; value: string }>;
}

export function integrationUrl(key: string, path: string): string {
  return `/api/integrations/${encodeURIComponent(key)}/${path}`;
}
