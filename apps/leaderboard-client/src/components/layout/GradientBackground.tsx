import type { PropsWithChildren } from "react";

type GradientBackgroundProps = PropsWithChildren<{
  /**
   * La couleur du fond fixe. Par défaut celle du thème du Lab ; les pages
   * vitrine passent la leur, celle de la maquette, pour que la navbar et le
   * footer reposent sur le même fond que le contenu.
   */
  background?: string;
}>;

export function GradientBackground({ background, children }: GradientBackgroundProps) {
  return (
    <>
      {/* Background fixe au viewport */}
      <div
        className="fixed inset-0 h-screen w-full"
        style={{ background: background ?? "var(--background)" }}
      />

      {/* Contenu qui peut défiler par-dessus */}
      <div className="relative min-h-screen text-white">
        {children}
      </div>
    </>
  );
}
