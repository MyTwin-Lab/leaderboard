import type { PropsWithChildren } from "react";

export function GradientBackground({ children }: PropsWithChildren) {
  return (
    <>
      {/* Background fixe au viewport */}
      <div className="fixed inset-0 h-screen w-full" style={{ background: "var(--background)" }} />

      {/* Contenu qui peut défiler par-dessus */}
      <div className="relative min-h-screen text-white">
        {children}
      </div>
    </>
  );
}
