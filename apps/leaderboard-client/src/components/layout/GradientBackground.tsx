import type { PropsWithChildren } from "react";

export function GradientBackground({ children }: PropsWithChildren) {
  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-[#0A1C3F] via-[#0D224F] to-[#050B1F] text-white">
      {children}
    </div>
  );
}
