'use client';

import { useEffect, useState } from 'react';

/**
 * Le seuil des maquettes vitrine : 768px, la largeur à laquelle la maquette
 * elle-même bascule sur son cadre iOS (`matchMedia("(min-width: 768px)")`).
 * Les feuilles `*-vitrine.css` coupent au même endroit.
 */
export const PHONE_QUERY = '(max-width: 767px)';

/**
 * « Sommes-nous sur un téléphone ? » — la question que le CSS ne peut pas
 * répondre : la page challenge ne change pas de style selon la largeur, elle
 * change d'écran (la vitrine plutôt que l'espace de travail, qu'un téléphone
 * ne sait pas montrer).
 *
 * `false` au premier rendu, serveur comme client : il n'y a pas de largeur
 * avant le montage, et inventer une valeur rendrait le HTML serveur différent
 * de la première passe client. Ce n'est pas visible ici — la page attend de
 * toute façon ses requêtes derrière un squelette, et le premier rendu utile
 * arrive après le montage.
 */
export function useIsPhone(): boolean {
  const [isPhone, setIsPhone] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(PHONE_QUERY);
    const sync = () => setIsPhone(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  return isPhone;
}
