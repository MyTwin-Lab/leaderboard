"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, AlertCircle, Loader2, Palette, Sun, Moon } from "lucide-react";
import { THEMES, type ThemeKey } from "@/lib/themes";

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface ThemeSettingsProps {
  currentTheme: ThemeKey;
  currentPrimaryColor: string | null;
  currentBackgroundColor: string | null;
  currentThemeMode: string;
}

export function ThemeSettings({
  currentTheme,
  currentPrimaryColor,
  currentBackgroundColor,
  currentThemeMode,
}: ThemeSettingsProps) {
  const router = useRouter();
  const [activePreset, setActivePreset] = useState<ThemeKey>(currentTheme);
  const [primaryColor, setPrimaryColor] = useState<string>(
    currentPrimaryColor ?? THEMES[currentTheme].brandCP
  );
  const [backgroundColor, setBackgroundColor] = useState<string>(
    currentBackgroundColor ?? THEMES[currentTheme].background
  );
  const [themeMode, setThemeMode] = useState<"dark" | "light">(
    currentThemeMode === "light" ? "light" : "dark"
  );
  const [status, setStatus] = useState<SaveStatus>("idle");

  const save = async (patch: {
    theme_key?: ThemeKey;
    primary_color?: string | null;
    background_color?: string | null;
    theme_mode?: "dark" | "light";
  }) => {
    setStatus("saving");
    const res = await fetch("/api/admin/theme", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      setStatus("saved");
      router.refresh();
      setTimeout(() => setStatus("idle"), 2500);
    } else {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  };

  const applyPreset = (key: ThemeKey) => {
    const tokens = THEMES[key];
    setActivePreset(key);
    setPrimaryColor(tokens.brandCP);
    setBackgroundColor(tokens.background);
    save({
      theme_key: key,
      primary_color: null,   // clear custom overrides — use palette
      background_color: null,
    });
  };

  const handlePrimaryChange = (hex: string) => {
    setPrimaryColor(hex);
  };

  const handlePrimaryCommit = (hex: string) => {
    save({ primary_color: hex });
  };

  const handleBackgroundChange = (hex: string) => {
    setBackgroundColor(hex);
  };

  const handleBackgroundCommit = (hex: string) => {
    save({ background_color: hex });
  };

  const toggleMode = () => {
    const next = themeMode === "dark" ? "light" : "dark";
    setThemeMode(next);
    save({ theme_mode: next });
  };

  return (
    <div className="animate-fade-up space-y-8 py-2">

      {/* ── Quick presets ── */}
      <div>
        <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-white/30">
          <Palette className="h-3.5 w-3.5" />
          Quick Presets
        </h2>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {(Object.entries(THEMES) as [ThemeKey, typeof THEMES[ThemeKey]][]).map(([key, tokens]) => {
            const isActive = activePreset === key && !status;
            return (
              <button
                key={key}
                onClick={() => applyPreset(key)}
                disabled={status === "saving"}
                className={`group relative flex flex-col items-center gap-2 rounded-xl border p-2.5 transition-all duration-200 focus-visible:outline-none disabled:opacity-50 ${
                  isActive
                    ? "border-white/30 bg-white/[0.07]"
                    : "border-white/[0.07] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.05]"
                }`}
              >
                <div className="relative h-9 w-9 overflow-hidden rounded-lg flex-shrink-0">
                  <div className="absolute inset-0" style={{ backgroundColor: tokens.background }} />
                  <div className="absolute bottom-0 left-0 right-0 h-4 rounded-t-full" style={{ backgroundColor: tokens.primary300 }} />
                  <div className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full" style={{ backgroundColor: tokens.brandCP }} />
                </div>
                <span className={`text-[10px] font-medium leading-tight ${isActive ? "text-white" : "text-white/40 group-hover:text-white/60"}`}>
                  {tokens.label}
                </span>
                {isActive && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-white/80" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Custom colors ── */}
      <div>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/30">
          Custom Colors
        </h2>
        <div className="flex flex-col gap-4 sm:flex-row">

          {/* Primary / Accent */}
          <label className="flex flex-1 cursor-pointer items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 transition-colors hover:border-white/20 hover:bg-white/[0.05]">
            <div
              className="h-8 w-8 flex-shrink-0 rounded-lg border border-white/20"
              style={{ backgroundColor: primaryColor }}
            />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-white/70">Accent color</p>
              <p className="text-[10px] text-white/30">{primaryColor}</p>
            </div>
            <input
              type="color"
              value={primaryColor}
              onChange={e => handlePrimaryChange(e.target.value)}
              onBlur={e => handlePrimaryCommit(e.target.value)}
              className="sr-only"
            />
          </label>

          {/* Background */}
          <label className="flex flex-1 cursor-pointer items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 transition-colors hover:border-white/20 hover:bg-white/[0.05]">
            <div
              className="h-8 w-8 flex-shrink-0 rounded-lg border border-white/20"
              style={{ backgroundColor: backgroundColor }}
            />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-white/70">Background</p>
              <p className="text-[10px] text-white/30">{backgroundColor}</p>
            </div>
            <input
              type="color"
              value={backgroundColor}
              onChange={e => handleBackgroundChange(e.target.value)}
              onBlur={e => handleBackgroundCommit(e.target.value)}
              className="sr-only"
            />
          </label>
        </div>
      </div>

      {/* ── Dark / Light mode ── */}
      <div>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/30">
          Mode
        </h2>
        <button
          onClick={toggleMode}
          disabled={status === "saving"}
          className="flex w-full items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 transition-colors hover:border-white/20 hover:bg-white/[0.05] disabled:opacity-50"
        >
          <div className="flex items-center gap-3">
            {themeMode === "dark"
              ? <Moon className="h-4 w-4 text-white/50" />
              : <Sun className="h-4 w-4 text-white/50" />
            }
            <div className="text-left">
              <p className="text-[11px] font-semibold text-white/70">
                {themeMode === "dark" ? "Dark mode" : "Light mode"}
              </p>
              <p className="text-[10px] text-white/30">
                {themeMode === "dark" ? "Light text on dark background" : "Dark text on light background"}
              </p>
            </div>
          </div>
          {/* Toggle pill */}
          <div className={`relative h-5 w-9 flex-shrink-0 rounded-full transition-colors duration-200 ${themeMode === "light" ? "bg-brandCP/70" : "bg-white/15"}`}>
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${themeMode === "light" ? "translate-x-4" : "translate-x-0.5"}`} />
          </div>
        </button>
      </div>

      {/* ── Status ── */}
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
