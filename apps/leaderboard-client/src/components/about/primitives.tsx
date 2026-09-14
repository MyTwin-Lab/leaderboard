import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowIcon } from "@/components/home/ArrowIcon";

/**
 * Les briques visuelles de la landing du Lab, dans la grammaire du reste du
 * site : le filet + libellé des en-têtes de l'accueil, les cartes translucides,
 * et le bouton plein aux couleurs `foreground` / `background` de
 * `HomeChallengesPreview` — ces deux tokens s'échangent avec le thème, là où
 * un `bg-white` opaque resterait blanc en mode clair.
 */

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="h-[2px] w-8 rounded-full bg-brandCP" />
      <span className="text-xs font-bold uppercase tracking-[0.22em] text-brandCP">{children}</span>
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2 className="text-balance text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl">{title}</h2>
      {children && <div className="flex flex-col gap-3 text-base leading-relaxed text-white/65">{children}</div>}
    </div>
  );
}

/** Les pages de mytwin.care passent par un <a> : next/link ne sert que ce site. */
function Anchor({ href, className, children }: { href: string; className: string; children: ReactNode }) {
  if (href.startsWith("http")) {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

export function PrimaryCta({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Anchor
      href={href}
      className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-semibold text-background transition-all duration-200 hover:-translate-y-0.5 hover:gap-2.5"
    >
      {children}
      <ArrowIcon />
    </Anchor>
  );
}

export function SecondaryCta({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Anchor
      href={href}
      className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:border-brandCP/40 hover:text-brandCP"
    >
      {children}
    </Anchor>
  );
}

export function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Anchor
      href={href}
      className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-brandCP transition-all duration-200 hover:gap-2"
    >
      {children}
      <ArrowIcon />
    </Anchor>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:p-6 ${className}`}>
      {children}
    </div>
  );
}
