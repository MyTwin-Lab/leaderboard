import { AlertCircle, Loader2 } from "lucide-react";

interface IntegrationCardProps {
  name: string;
  /** La phrase sous le nom : ce que l'intégration apporte. */
  description: string;
  loading: boolean;
  connected: boolean;
  error?: string | null;
  /** Les lignes « clé → valeur » d'une connexion établie. */
  details?: { label: string; value: string }[];
  /** Ce qu'il faut saisir pour se connecter — une clé d'API, par exemple. */
  form?: React.ReactNode;
  action: {
    label: string;
    onClick: () => void;
    busy?: boolean;
    disabled?: boolean;
    /** Le contour au lieu du fond plein : défaire n'est pas l'action offerte. */
    quiet?: boolean;
  };
}

/**
 * La carte d'une intégration, d'après `Profile Vitrine.dc.html`.
 *
 * Une seule forme pour les cinq services : nom, état, phrase, bouton. Les cinq
 * cartes portaient le même balisage recopié — chacune garde sa logique (son
 * `status`, ses champs, sa route) et vient chercher la forme ici.
 */
export function IntegrationCard({
  name,
  description,
  loading,
  connected,
  error,
  details,
  form,
  action,
}: IntegrationCardProps) {
  return (
    <div className="v-pro-int">
      <div className="v-pro-int-head">
        <span className="v-pro-int-name">{name}</span>
        {loading ? (
          <span className="v-pro-int-state">
            <Loader2 className="h-3 w-3 animate-spin" />
          </span>
        ) : (
          <span className="v-pro-int-state" data-on={connected}>
            {connected ? "Connected" : "Not connected"}
          </span>
        )}
      </div>

      {error && (
        <p className="v-pro-alert">
          <AlertCircle />
          {error}
        </p>
      )}

      <span className="v-pro-int-desc">{description}</span>

      {connected && details && details.length > 0 && (
        <dl className="v-pro-int-details">
          {details.map((detail) => (
            <div key={detail.label} className="v-pro-int-row">
              <dt>{detail.label}</dt>
              <dd>{detail.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {!connected && form}

      <button
        onClick={action.onClick}
        disabled={loading || action.busy || action.disabled}
        className="v-pro-int-btn"
        data-tone={action.quiet ? "quiet" : undefined}
      >
        {action.busy && <Loader2 className="animate-spin" />}
        {action.label}
      </button>
    </div>
  );
}
