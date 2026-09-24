"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import Image from "next/image";

import { MyTwinLogo } from "@/components/layout/MyTwinLogo";
import { vitrineFontVars } from "@/components/vitrine/fonts";
import { HomeArrow } from "./HomeSection";

/**
 * La prépage de la racine : une image plein écran, la marque et sa promesse en
 * haut, et un seul bouton en bas pour entrer.
 *
 * Elle est posée **par-dessus** l'accueil, pas à sa place — l'accueil est rendu
 * dessous et n'attend rien. C'est ce qui la rend sans risque : si le JavaScript
 * ne s'exécute jamais, la prépage reste visible mais la page qu'elle couvre est
 * déjà complète dans le HTML, et les moteurs la lisent normalement.
 *
 * Elle s'ouvre à chaque arrivée sur `/`, sans mémoire. Un `sessionStorage` la
 * ferait disparaître au retour dans la même session ; c'est une décision de
 * produit, pas de code, donc elle attend d'être demandée.
 *
 * Le logo de la navbar la rouvre quand on est déjà sur `/` : un lien vers la
 * page courante ne remonte rien, donc il le signale par `HOME_GATE_OPEN_EVENT`.
 *
 * Une seule exception à cette ouverture systématique : `/#lab`, par où revient
 * le « Back to the Lab » de la page vision. Ce lien ramène à l'accueil tel
 * qu'on l'a quitté — derrière la prépage — et non à la porte qu'on a déjà
 * poussée. Le logo, lui, continue de la rouvrir ensuite.
 */
export const HOME_GATE_OPEN_EVENT = "home-gate:open";

/** Le fragment qui demande à sauter la prépage. */
const SKIP_HASH = "#lab";

/**
 * Le saut doit être décidé **avant** le premier affichage, sinon la prépage
 * apparaît le temps d'une image avant de disparaître. `useLayoutEffect` s'en
 * charge sur le client ; au rendu serveur il n'existe pas, et React le dit
 * bruyamment, donc on retombe sur `useEffect` — qui n'y sert de toute façon à
 * rien puisqu'aucun effet ne s'exécute là-bas.
 */
const useBeforePaint = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function HomeGate() {
  const [open, setOpen] = useState(true);
  // La sortie est animée, donc la prépage survit à son propre `open: false` le
  // temps du fondu, et ne se démonte qu'après.
  const [gone, setGone] = useState(false);

  // On entre toujours par le haut de l'accueil. Un défilement a pu passer
  // malgré tout — avant l'hydratation, ou restauré par le navigateur au
  // rechargement — et la prépage se lèverait sur une page déjà descendue.
  const close = () => {
    window.scrollTo(0, 0);
    setOpen(false);
  };

  // Rouvrir remonte la prépage si elle était déjà partie — ses animations
  // d'arrivée rejouent — ou la ramène en plein fondu de sortie.
  useEffect(() => {
    const reopen = () => {
      setGone(false);
      setOpen(true);
    };
    window.addEventListener(HOME_GATE_OPEN_EVENT, reopen);
    return () => window.removeEventListener(HOME_GATE_OPEN_EVENT, reopen);
  }, []);

  // On arrive par `/#lab` : la prépage ne s'affiche pas du tout. Elle n'est pas
  // fermée en fondu, elle est sautée — il n'y a rien à faire disparaître.
  useBeforePaint(() => {
    if (window.location.hash !== SKIP_HASH) return;
    // Le fragment a joué son rôle : on le retire pour que la barre d'adresse
    // affiche la racine, et qu'un rechargement — ou le logo de la navbar —
    // rouvre la prépage normalement.
    window.history.replaceState(null, "", window.location.pathname);
    window.scrollTo(0, 0);
    setOpen(false);
    setGone(true);
  }, []);

  useEffect(() => {
    if (!open || gone) return;

    // Rien ne défile derrière une page qui couvre l'écran. Le verrou se pose
    // sur `<html>`, pas sur `<body>` : `html` porte déjà `overflow-x: clip`
    // (globals.css), donc le `overflow` de `body` n'est plus reporté sur la
    // fenêtre — c'est `html` qui défile, et c'est lui qu'il faut bloquer.
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";

    // Échap ferme aussi : une page qui couvre tout doit avoir une sortie au
    // clavier, et pas seulement un bouton à viser.
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);

    return () => {
      root.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, gone]);

  if (gone) return null;

  return (
    <div
      className={`vitrine-embed v-gate ${vitrineFontVars}`}
      data-open={open ? "true" : "false"}
      // Le démontage suit le fondu plutôt qu'un délai posé à la main : si la
      // transition est coupée (`prefers-reduced-motion`), l'événement part
      // tout de suite et la prépage disparaît sans attendre.
      //
      // Les deux gardes comptent. `transitionend` remonte depuis les enfants —
      // le bouton en a une au survol — et la sortie anime trois propriétés à la
      // fois : sans elles, la prépage se démonterait au premier survol venu, ou
      // au milieu de son propre fondu.
      onTransitionEnd={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.propertyName !== "opacity") return;
        if (!open) setGone(true);
      }}
    >
      {/* La photo du téléphone, en portrait. Celle du PC est un fond CSS posé
          par `home-gate.css` : deux fichiers de formats opposés, et changer de
          fichier selon la largeur n'est pas quelque chose que <Image> sait
          faire.

          Elle est posée dans un cadre plutôt que directement : `fill` fixe sa
          boîte en style inline, et c'est le cadre qui la prolonge sous le bas
          de l'écran sur iOS — voir `home-gate.css`. */}
      <div aria-hidden="true" className="v-gate-frame">
        <Image
          src="/home/enter-the-lab.jpg"
          alt=""
          aria-hidden
          fill
          sizes="100vw"
          priority
          className="v-gate-shot"
        />
      </div>
      {/* Le haut de la photo est très clair, le bas chargé : un voile léger
          garantit le contraste du texte sans assombrir la scène. */}
      <div aria-hidden="true" className="v-gate-veil" />

      <div className="v-gate-top">
        <MyTwinLogo className="v-gate-logo" />
        <h1 className="v-gate-title">
          Building the world&rsquo;s most advanced human digital twin
        </h1>
        <p className="v-gate-lede">
          Predictive, Preventive, Personalized and Proactive health
        </p>
      </div>

      <button type="button" className="v-gate-cta" onClick={close}>
        Enter the lab
        <HomeArrow />
      </button>
    </div>
  );
}
