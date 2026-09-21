"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";

const BASE_SPEED = 0.5; // px par frame
const FRICTION = 0.95;
const VELOCITY_EPSILON = 0.1;

export type CarouselItem = {
  name: string;
  role: string;
  photo: string;
  country: string;
};

// Porté de la landing MyTwin Health (`/patients`) : défilement continu, que
// l'on peut attraper et lancer. Décoratif : la liste lisible est à côté.
export function ContributorsCarousel({ items }: { items: ReadonlyArray<CarouselItem> }) {
  const trackRef = useRef<HTMLDivElement>(null);
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
        // La piste est dupliquée : la moitié de sa largeur fait un cycle complet.
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

  return (
    <div
      aria-hidden
      className="l-carousel"
      onMouseDown={(event) => handleDragStart(event.clientX)}
      onMouseMove={(event) => handleDragMove(event.clientX)}
      onMouseUp={handleDragEnd}
      onMouseLeave={handleDragEnd}
      onTouchStart={(event) => handleDragStart(event.touches[0].clientX)}
      onTouchMove={(event) => handleDragMove(event.touches[0].clientX)}
      onTouchEnd={handleDragEnd}
    >
      <div ref={trackRef} className="l-carousel__track">
        {[0, 1].map((cycle) =>
          items.map((item, index) => (
            <div key={`${cycle}-${item.name}-${index}`} className="l-person">
              <div className="l-person__photo">
                <Image
                  src={`/landing/contributors/${item.photo}`}
                  alt=""
                  width={84}
                  height={84}
                  draggable={false}
                  loading="lazy"
                />
                <Image
                  className="l-person__flag"
                  src={`/landing/flags/${item.country}.png`}
                  alt=""
                  width={40}
                  height={30}
                  draggable={false}
                  loading="lazy"
                />
              </div>
              <div>
                <p className="l-person__name">{item.name}</p>
                <p className="l-person__role">{item.role}</p>
              </div>
            </div>
          )),
        )}
      </div>
    </div>
  );
}
