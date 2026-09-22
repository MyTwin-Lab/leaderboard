"use client";

import { useEffect, useState } from "react";
import { Star } from "lucide-react";

/**
 * L'état d'un sandbox tel que les deux verbes de `/star` le renvoient.
 * Même forme pour `PUT` et `DELETE` : l'UI n'a qu'un câblage à faire.
 */
export interface StarState {
  star_count: number;
  my_star: boolean;
  paid_tier_thresholds: number[];
}

interface StarButtonProps {
  sandboxId: string;
  starCount: number;
  myStar: boolean;
  /** L'auteur ne star pas le sien, et un sandbox promu ou archivé ne se star plus. */
  disabled?: boolean;
  /** Ce que dit l'infobulle quand le bouton est inerte. */
  disabledReason?: string;
  /** `compact` sur une carte (l'étoile et le nombre), `full` sur le détail. */
  variant?: "compact" | "full";
  /** Remonte l'état servi par l'API — le détail s'en sert pour les paliers. */
  onState?: (state: StarState) => void;
}

/** Le message affiché sous le bouton, selon ce que l'API a refusé. */
function messageForStatus(status: number): string {
  switch (status) {
    // Le seul refus qui a une sortie : se connecter. C'est exactement le cas
    // du visiteur légitime derrière une IP partagée (campus, entreprise), que
    // le plafond horaire des stars anonymes atteint sans qu'il y soit pour
    // rien — un compte est borné à une star par sandbox, pas à un débit.
    case 429:
      return "Too many stars from this network. Sign in to keep starring.";
    case 403:
      return "You can’t star your own sandbox.";
    case 409:
      return "This sandbox is no longer open to stars.";
    case 404:
      return "This sandbox no longer exists.";
    default:
      return "Couldn’t save your star. Try again.";
  }
}

/**
 * La bascule d'une star, optimiste — sans aucun habillage.
 *
 * Extrait du bouton pour que la carte de la maquette vitrine, qui pose son
 * étoile sur la photo, partage exactement le même comportement : le compteur
 * bouge avant la réponse, la réponse fait autorité, une erreur défait
 * l'estimation et s'explique.
 */
export function useStarToggle({
  sandboxId,
  starCount,
  myStar,
  disabled = false,
  onState,
}: {
  sandboxId: string;
  starCount: number;
  myStar: boolean;
  disabled?: boolean;
  onState?: (state: StarState) => void;
}) {
  const [count, setCount] = useState(starCount);
  const [starred, setStarred] = useState(myStar);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Le serveur reprend la main dès que le parent rafraîchit ses données : sans
  // ça, un compteur corrigé ailleurs (rattachement d'une star anonyme, ménage
  // admin) resterait figé sur l'estimation locale.
  useEffect(() => {
    setCount(starCount);
    setStarred(myStar);
  }, [sandboxId, starCount, myStar]);

  const toggle = async () => {
    if (disabled || pending) return;

    const next = !starred;
    setStarred(next);
    setCount((current) => Math.max(0, current + (next ? 1 : -1)));
    setError(null);
    setPending(true);

    try {
      const res = await fetch(`/api/sandboxes/${sandboxId}/star`, {
        method: next ? "PUT" : "DELETE",
      });
      if (!res.ok) {
        // Retour à l'état d'avant : l'optimisme n'a de sens que s'il se défait.
        setStarred(!next);
        setCount((current) => Math.max(0, current + (next ? -1 : 1)));
        setError(messageForStatus(res.status));
        return;
      }
      const state = (await res.json()) as StarState;
      setCount(state.star_count);
      setStarred(state.my_star);
      onState?.(state);
    } catch {
      setStarred(!next);
      setCount((current) => Math.max(0, current + (next ? -1 : 1)));
      setError("Network error. Try again.");
    } finally {
      setPending(false);
    }
  };

  return { count, starred, pending, error, toggle };
}

/**
 * Le bouton étoile, optimiste.
 *
 * Le compteur bouge avant la réponse : starer est un geste sans conséquence
 * pour celui qui le fait, attendre un aller-retour serveur n'apporterait rien
 * qu'un délai. La réponse fait autorité et remplace l'estimation ; une erreur
 * la défait et s'explique juste en dessous.
 *
 * Public — un visiteur non connecté star aussi, et c'est `PUT /star` qui lui
 * pose alors son cookie d'identité anonyme.
 */
export function StarButton({
  sandboxId,
  starCount,
  myStar,
  disabled = false,
  disabledReason,
  variant = "compact",
  onState,
}: StarButtonProps) {
  const { count, starred, pending, error, toggle } = useStarToggle({
    sandboxId,
    starCount,
    myStar,
    disabled,
    onState,
  });

  const compact = variant === "compact";
  const label = disabled ? "Stars" : starred ? "Starred" : "Star";

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={disabled || pending}
        title={disabled ? disabledReason : undefined}
        aria-pressed={starred}
        aria-label={`${starred ? "Unstar" : "Star"} this sandbox`}
        className={`inline-flex shrink-0 items-center gap-2 rounded-full border font-semibold transition-all duration-200 ${
          compact ? "px-3.5 py-1.5 text-[13px]" : "px-4.5 py-2.5 text-[13px]"
        } ${
          starred
            ? "border-yellow-400/40 bg-yellow-400/10 text-white"
            : "border-white/10 bg-white/[0.04] text-white/70 hover:border-white/20 hover:bg-white/[0.07] hover:text-white"
        } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"} ${
          pending ? "opacity-70" : ""
        }`}
      >
        <Star
          className={`${compact ? "h-3.5 w-3.5" : "h-[15px] w-[15px]"} ${
            starred ? "fill-yellow-400 text-yellow-400" : ""
          }`}
        />
        {compact ? (
          count
        ) : (
          <>
            {label}
            <span className="rounded-full bg-white/10 px-2 py-px text-xs font-bold text-white">
              {count}
            </span>
          </>
        )}
      </button>

      {error && <span className="max-w-[220px] text-right text-[11px] leading-snug text-red-400">{error}</span>}
    </div>
  );
}
