import type { PropsWithChildren } from "react";

export function GradientBackground({ children }: PropsWithChildren) {
  return (
    <>
      {/* Background fixe au viewport */}
      <div className="fixed inset-0 h-screen w-full bg-gradient-to-b from-[#0A1C3F] via-[#0D224F] to-[#050B1F]" />

      {/* Contenu qui peut défiler par-dessus */}
      <div className="relative min-h-screen text-white">
        {children}
      </div>
    </>
  );
}
