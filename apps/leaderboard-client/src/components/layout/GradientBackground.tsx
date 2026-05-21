import type { PropsWithChildren } from "react";

export function GradientBackground({ children }: PropsWithChildren) {
  return (
    <>
      {/* Background fixe au viewport */}
      <div className="fixed inset-0 h-screen w-full bg-gradient-to-b from-[var(--gradient-from)] via-[var(--gradient-via)] to-[var(--gradient-to)]" />

      {/* Contenu qui peut défiler par-dessus */}
      <div className="relative min-h-screen text-white">
        {children}
      </div>
    </>
  );
}
