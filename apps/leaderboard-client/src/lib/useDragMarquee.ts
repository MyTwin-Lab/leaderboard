"use client";

import { useEffect, useRef, type MouseEvent, type TouchEvent } from "react";

const BASE_SPEED = 0.5; // px par frame
const FRICTION = 0.95;
const VELOCITY_EPSILON = 0.1;

/**
 * Le mouvement du carousel des contributeurs, porté de la landing MyTwin Health
 * (`/patients`) : défilement continu, que l'on peut attraper et lancer. La
 * landing `/` et l'accueil `/home` ont chacune leur habillage, le mouvement est
 * le même.
 *
 * La piste doit contenir ses éléments deux fois de suite : la moitié de sa
 * largeur fait un cycle complet. Sous `prefers-reduced-motion`, elle ne défile
 * plus d'elle-même, mais se laisse toujours tirer.
 */
export function useDragMarquee<T extends HTMLElement>() {
  const trackRef = useRef<T>(null);
  const positionRef = useRef(0);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const dragOffsetRef = useRef(0);
  const velocityRef = useRef(0);
  const lastXRef = useRef(0);
  const lastTimeRef = useRef(0);
  const reduceMotionRef = useRef(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => {
      reduceMotionRef.current = query.matches;
    };
    syncMotion();
    query.addEventListener("change", syncMotion);

    let animationId = 0;
    const animate = () => {
      const track = trackRef.current;
      if (track) {
        const cycleWidth = track.scrollWidth / 2;

        if (!isDraggingRef.current) {
          if (reduceMotionRef.current) {
            velocityRef.current = 0;
          } else {
            positionRef.current += BASE_SPEED + velocityRef.current;
            velocityRef.current *= FRICTION;
            if (Math.abs(velocityRef.current) < VELOCITY_EPSILON) velocityRef.current = 0;
          }
        }

        if (cycleWidth > 0) {
          if (positionRef.current >= cycleWidth) positionRef.current -= cycleWidth;
          if (positionRef.current < 0) positionRef.current += cycleWidth;
        }

        track.style.transform = `translate3d(-${positionRef.current}px, 0, 0)`;
      }
      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(animationId);
      query.removeEventListener("change", syncMotion);
    };
  }, []);

  const handleDragStart = (clientX: number) => {
    isDraggingRef.current = true;
    startXRef.current = clientX;
    dragOffsetRef.current = positionRef.current;
    lastXRef.current = clientX;
    lastTimeRef.current = Date.now();
    velocityRef.current = 0;
  };

  const handleDragMove = (clientX: number) => {
    if (!isDraggingRef.current) return;
    const now = Date.now();
    const elapsed = now - lastTimeRef.current;
    if (elapsed > 0 && !reduceMotionRef.current) {
      // px/ms ramenés à une vitesse par frame (~60 fps).
      velocityRef.current = ((lastXRef.current - clientX) / elapsed) * 16;
    }
    lastXRef.current = clientX;
    lastTimeRef.current = now;
    positionRef.current = dragOffsetRef.current + (startXRef.current - clientX);
  };

  const handleDragEnd = () => {
    isDraggingRef.current = false;
  };

  /** À poser sur le conteneur qui masque la piste. */
  const dragHandlers = {
    onMouseDown: (event: MouseEvent) => handleDragStart(event.clientX),
    onMouseMove: (event: MouseEvent) => handleDragMove(event.clientX),
    onMouseUp: handleDragEnd,
    onMouseLeave: handleDragEnd,
    onTouchStart: (event: TouchEvent) => handleDragStart(event.touches[0].clientX),
    onTouchMove: (event: TouchEvent) => handleDragMove(event.touches[0].clientX),
    onTouchEnd: handleDragEnd,
  };

  return { trackRef, dragHandlers };
}
