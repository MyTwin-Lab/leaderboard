"use client";

import { useEffect, useRef, useState, type CSSProperties, type PropsWithChildren } from "react";

type RevealProps = PropsWithChildren<{
  className?: string;
  /** Décalage en ms, pour échelonner des éléments voisins. */
  delay?: number;
}>;

/** Fait apparaître son contenu, une seule fois, quand il entre dans l'écran. */
export function Reveal({ children, className, delay = 0 }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className ? `l-reveal ${className}` : "l-reveal"}
      data-visible={visible}
      style={delay ? ({ "--l-delay": `${delay}ms` } as CSSProperties) : undefined}
    >
      {children}
    </div>
  );
}
