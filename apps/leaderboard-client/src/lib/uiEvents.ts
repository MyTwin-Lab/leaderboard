/**
 * Événements d'interface (`ui.*`) — les seuls émis depuis le navigateur
 * (challenge 020, L6). Ils ne prouvent qu'un clic : la route `/api/events/ui`
 * n'accepte qu'un compte connecté, les types `ui.*` que la plateforme déclare,
 * et un challenge ou un meeting que l'appelant peut voir.
 *
 * Sans attente ni erreur visible : un événement perdu ne coûte qu'une quête
 * validée plus tard.
 */
export function emitUiEvent(type: `ui.${string}`, payload: Record<string, string>): void {
  void fetch('/api/events/ui', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, payload }),
    // L'événement part même si le clic ouvre un autre onglet ou quitte la page.
    keepalive: true,
  }).catch(() => {});
}
