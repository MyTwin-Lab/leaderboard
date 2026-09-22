'use client';

import { useEffect } from 'react';

/** Le fond des maquettes vitrine, le même que celui posé par `LabShell`. */
export const VITRINE_BACKGROUND = '#fbfaf8';

/**
 * Peint le chrome du Lab à la couleur de la maquette, le temps où l'écran
 * vitrine est à l'écran.
 *
 * Les trois listings obtiennent ça par leur URL : `LabShell` lit son chemin et
 * passe la couleur à `GradientBackground`. La page d'un challenge ne peut pas
 * en faire autant — la même URL sert l'écran vitrine à qui n'a pas rejoint et
 * l'espace de travail, resté au thème du Lab, à qui l'a fait. La bascule est un
 * état, pas une route : c'est donc l'écran lui-même qui pose la couleur.
 *
 * `--background` plutôt qu'un calque posé sur la page : le fond du Lab est fixe
 * au viewport et la navbar y compose sa gélule. Un calque le recouvrirait, mais
 * laisserait la navbar et le footer sur l'ancienne couleur — visible dès le
 * premier défilement.
 *
 * La valeur d'origine est celle du `style` en ligne de `<html>`, posé par le
 * layout racine d'après `app_settings` : on la remet au démontage plutôt que de
 * supposer un thème.
 */
export function useVitrineChrome(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const root = document.documentElement;
    const previous = root.style.getPropertyValue('--background');
    root.style.setProperty('--background', VITRINE_BACKGROUND);
    return () => {
      if (previous) root.style.setProperty('--background', previous);
      else root.style.removeProperty('--background');
    };
  }, [active]);
}
