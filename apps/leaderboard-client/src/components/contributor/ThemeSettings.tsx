"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, AlertCircle, Loader2, Palette } from "lucide-react";
import { THEMES, type ThemeKey } from "@/lib/themes";

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function ThemeSettings({ currentTheme }: { currentTheme: ThemeKey }) {
  const router = useRouter();
  const [active, setActive] = useState<ThemeKey>(currentTheme);
  const [status, setStatus] = useState<SaveStatus>("idle");

  const applyTheme = async (key: ThemeKey) => {
    if (key === active || status === "saving") return;
    setActive(key);
    setStatus("saving");

    const res = await fetch("/api/admin/theme", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme_key: key }),
    });

    if (res.ok) {
      setStatus("saved");
      router.refresh();
      setTimeout(() => setStatus("idle"), 2500);
    } else {
      setActive(currentTheme);
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  };

  return (
    <div className="animate-fade-up space-y-8 py-2">

      {/* Header */}
      <div>
        <h2 className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-white/30">
          <Palette className="h-3.5 w-3.5" />
          App Theme
        </h2>
        <p className="text-xs text-white/25">
          Changes apply immediately for all users.
        </p>
      </div>

      {/* Palette grid */}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {(Object.entries(THEMES) as [ThemeKey, typeof THEMES[ThemeKey]][]).map(([key, tokens]) => {
          const isActive = active === key;
          return (
            <button
              key={key}
              onClick={() => applyTheme(key)}
              disabled={status === "saving"}
              className={`group relative flex flex-col items-center gap-2 rounded-xl border p-3 transition-all duration-200 focus-visible:outline-none disabled:opacity-50 ${
                isActive
                  ? "border-white/30 bg-white/[0.07]"
                  : "border-white/[0.07] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.05]"
              }`}
            >
              {/* Swatch */}
              <div className="relative h-10 w-10 overflow-hidden rounded-lg">
                <div
                  className="absolute inset-0"
                  style={{ backgroundColor: tokens.background }}
                />
                <div
                  className="absolute bottom-0 left-0 right-0 h-5 rounded-t-full"
                  style={{ backgroundColor: tokens.primary300 }}
                />
                <div
                  className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: tokens.brandCP }}
                />
              </div>

              {/* Label */}
              <span className={`text-[10px] font-medium ${isActive ? "text-white" : "text-white/40 group-hover:text-white/60"}`}>
                {tokens.label}
              </span>

              {/* Active dot */}
              {isActive && (
                <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-white/80" />
              )}
            </button>
          );
        })}
      </div>

      {/* Status */}
      <div className="flex items-center justify-end h-5">
        {status === "saving" && (
          <span className="animate-slide-in flex items-center gap-1.5 text-xs text-white/35">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Applying…
          </span>
        )}
        {status === "saved" && (
          <span className="animate-slide-in flex items-center gap-1.5 text-xs text-green-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Theme applied
          </span>
        )}
        {status === "error" && (
          <span className="animate-slide-in flex items-center gap-1.5 text-xs text-red-400">
            <AlertCircle className="h-3.5 w-3.5" />
            Failed to apply
          </span>
        )}
      </div>
    </div>
  );
}
