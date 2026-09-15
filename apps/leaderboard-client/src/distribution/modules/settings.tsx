"use client";

import { useState, type ComponentType, type ReactNode } from "react";
import { Compass, FileClock, FlaskConical, Puzzle, Video } from "lucide-react";
import { SandboxSettings } from "@/components/contributor/SandboxSettings";
import type { SandboxStarTier } from "@packages/database-service/domain/entities";

/**
 * Distribution MyTwin — l'écran des modules
 * -----------------------------------------
 * L'icône et l'éditeur de réglages de chaque module installé, rendus par
 * l'écran générique des modules (`components/contributor/ModulesPanel.tsx`).
 * Un module sans éditeur n'a qu'un interrupteur.
 */

/** Un module tel que l'écran l'affiche : ce que rend `GET /api/modules/[key]`, sans date. */
export interface ModuleEntry {
  key: string;
  label: string;
  description: string | null;
  enabled: boolean;
  settings: Record<string, unknown>;
}

export interface ModuleSettingsEditorProps {
  settings: Record<string, unknown>;
  /** L'état du module après un enregistrement réussi. */
  onSaved(entry: ModuleEntry): void;
}

const ICON_CLASS = "h-4 w-4 text-white/50";

const ICONS: Record<string, ReactNode> = {
  meetings: <Video className={ICON_CLASS} />,
  onboarding: <Compass className={ICON_CLASS} />,
  digest: <FileClock className={ICON_CLASS} />,
  sandbox: <FlaskConical className={ICON_CLASS} />,
};

export function moduleIcon(key: string): ReactNode {
  return ICONS[key] ?? <Puzzle className={ICON_CLASS} />;
}

/** Enregistre les réglages d'un module ; rend son état, ou lève avec le message de la route. */
export async function saveModuleSettings(key: string, settings: Record<string, unknown>): Promise<ModuleEntry> {
  const res = await fetch(`/api/modules/${encodeURIComponent(key)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ settings }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.details ?? body?.error ?? "Failed to save");
  return body as ModuleEntry;
}

/** Le digest : l'intervalle entre deux digests automatiques. */
function DigestSettingsEditor({ settings, onSaved }: ModuleSettingsEditorProps) {
  const saved = typeof settings.frequency_days === "number" ? settings.frequency_days : 7;
  const [frequency, setFrequency] = useState(String(saved));
  const [error, setError] = useState<string | null>(null);

  const commit = async () => {
    const days = Number(frequency);
    if (!Number.isInteger(days) || days < 1 || days > 365) {
      setFrequency(String(saved));
      setError("Frequency must be a whole number of days between 1 and 365");
      return;
    }
    if (days === saved) return;
    setError(null);
    try {
      onSaved(await saveModuleSettings("digest", { frequency_days: days }));
    } catch (e) {
      setFrequency(String(saved));
      setError(e instanceof Error ? e.message : "Failed to save");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-white/70">Interval</p>
          <p className="mt-0.5 text-xs text-white/35">Days between two automatic digests</p>
        </div>
        <input
          type="number"
          min={1}
          max={365}
          value={frequency}
          onChange={(e) => setFrequency(e.target.value)}
          onBlur={() => void commit()}
          className="w-20 shrink-0 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-right text-sm text-white focus:border-brandCP/40 focus:outline-none"
        />
      </div>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}

/** La sandbox : l'économie des stars et l'audit, dans le composant du module. */
function SandboxSettingsEditor({ settings }: ModuleSettingsEditorProps) {
  return (
    <SandboxSettings
      tiers={Array.isArray(settings.star_tiers) ? (settings.star_tiers as SandboxStarTier[]) : []}
      promotionBonusCp={typeof settings.promotion_bonus_cp === "number" ? settings.promotion_bonus_cp : 0}
    />
  );
}

export const moduleSettingsEditors: Readonly<Record<string, ComponentType<ModuleSettingsEditorProps>>> = {
  digest: DigestSettingsEditor,
  sandbox: SandboxSettingsEditor,
};
