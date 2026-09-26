"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { THEMES, type ThemeKey } from "@/lib/themes";

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface ThemeSettingsProps {
  currentTheme: ThemeKey;
  currentPrimaryColor: string | null;
  currentBackgroundColor: string | null;
  currentThemeMode: string;
}

/**
 * L'onglet Appearance, d'après `Profile Vitrine.dc.html` : une grille de
 * thèmes montrés par trois pastilles — fond, accent, encre — puis
 * l'interrupteur du mode sombre sur la carte teintée.
 *
 * Les deux couleurs libres ne sont pas dans la maquette : elles écrasent celles
 * du thème choisi, et ce réglage existe déjà. Elles gardent donc leur bloc, à
 * la matière de la page.
 */
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
    setThemeMode(tokens.mode);
    save({
      theme_key: key,
      primary_color: null,      // clear custom overrides — use palette
      background_color: null,
      theme_mode: tokens.mode,  // apply the preset's mode
    });
  };

  const toggleMode = () => {
    const next = themeMode === "dark" ? "light" : "dark";
    setThemeMode(next);
    save({ theme_mode: next });
  };

  return (
    <>
      <span className="v-pro-kicker">Theme</span>

      <div className="v-pro-themes">
        {(Object.entries(THEMES) as [ThemeKey, typeof THEMES[ThemeKey]][]).map(([key, tokens]) => (
          <button
            key={key}
            onClick={() => applyPreset(key)}
            disabled={status === "saving"}
            className="v-pro-theme"
            data-on={activePreset === key}
          >
            {/* Les trois pastilles de la maquette : le fond, l'accent, et le
                fond sombre du thème — il n'y a pas de jeton d'encre à montrer. */}
            <span className="v-pro-theme-swatches">
              <span style={{ background: tokens.background }} />
              <span style={{ background: tokens.brandCP }} />
              <span style={{ background: tokens.backgroundDark }} />
            </span>
            <span className="v-pro-theme-label">{tokens.label}</span>
          </button>
        ))}
      </div>

      <div className="v-pro-switch-row" data-tone="mint">
        <div className="v-pro-switch-text">
          <span className="v-pro-switch-label">Dark mode</span>
          <span className="v-pro-switch-desc">
            Applies to every contributor until they override it.
          </span>
        </div>
        <button
          onClick={toggleMode}
          disabled={status === "saving"}
          className="v-pro-toggle"
          data-on={themeMode === "dark"}
          aria-label="Toggle dark mode"
          aria-pressed={themeMode === "dark"}
        >
          <span />
        </button>
      </div>

      {/* Les deux couleurs libres, hors maquette : elles prennent le pas sur le
          thème choisi jusqu'à ce qu'on en choisisse un autre. */}
      <span className="v-pro-kicker">Custom colors</span>
      <div className="v-pro-cards">
        <ColorField
          label="Accent color"
          value={primaryColor}
          onChange={setPrimaryColor}
          onCommit={(hex) => save({ primary_color: hex })}
        />
        <ColorField
          label="Background"
          value={backgroundColor}
          onChange={setBackgroundColor}
          onCommit={(hex) => save({ background_color: hex })}
        />
      </div>

      <div className="v-pro-save">
        {status === "saving" && (
          <span data-state="saving">
            <Loader2 className="animate-spin" />
            Applying…
          </span>
        )}
        {status === "saved" && (
          <span data-state="saved">
            <CheckCircle2 />
            Theme applied
          </span>
        )}
        {status === "error" && (
          <span data-state="error">
            <AlertCircle />
            Failed to apply
          </span>
        )}
      </div>
    </>
  );
}

function ColorField({
  label,
  value,
  onChange,
  onCommit,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
  onCommit: (hex: string) => void;
}) {
  return (
    <label className="v-pro-switch-row" style={{ cursor: "pointer", gap: "0.875rem" }}>
      <span
        className="v-pro-theme-swatches"
        style={{ flex: "none" }}
      >
        <span style={{ background: value, width: "2rem", height: "2rem" }} />
      </span>
      <div className="v-pro-switch-text" style={{ flex: 1 }}>
        <span className="v-pro-switch-label">{label}</span>
        <span className="v-pro-switch-desc">{value}</span>
      </div>
      <input
        type="color"
        value={value}
        onChange={e => onChange(e.target.value)}
        onBlur={e => onCommit(e.target.value)}
        className="sr-only"
      />
    </label>
  );
}
