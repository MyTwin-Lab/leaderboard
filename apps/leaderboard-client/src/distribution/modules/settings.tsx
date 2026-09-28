"use client";

import { useState, type ComponentType } from "react";
import { SandboxSettings } from "@/components/contributor/SandboxSettings";
import { WatchSettings } from "@/components/watch/WatchSettings";
import type { SandboxStarTier } from "@packages/database-service/domain/entities";

/**
 * Distribution MyTwin — l'écran des modules
 * -----------------------------------------
 * L'éditeur de réglages de chaque module installé, rendu par l'écran
 * générique des modules (`components/contributor/ModulesPanel.tsx`), à la
 * matière du profil vitrine. Un module sans éditeur n'a qu'un interrupteur.
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
    <>
      <div className="v-pro-switch-row">
        <div className="v-pro-switch-text">
          <span className="v-pro-switch-label">Interval</span>
          <span className="v-pro-switch-desc">Days between two automatic digests</span>
        </div>
        <div className="v-pro-num" data-fixed="true">
          <input
            type="number"
            min={1}
            max={365}
            value={frequency}
            onChange={(e) => setFrequency(e.target.value)}
            onBlur={() => void commit()}
          />
          <span className="v-pro-num-unit">days</span>
        </div>
      </div>
      {error && <p className="v-pro-error">{error}</p>}
    </>
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

/** Le module watch : le contact OpenAlex, les domaines et les bornes de la page, dans le composant du module. */
function WatchSettingsEditor({ settings, onSaved }: ModuleSettingsEditorProps) {
  return <WatchSettings settings={settings} onSaved={onSaved} save={(next) => saveModuleSettings("watch", next)} />;
}

export const moduleSettingsEditors: Readonly<Record<string, ComponentType<ModuleSettingsEditorProps>>> = {
  digest: DigestSettingsEditor,
  sandbox: SandboxSettingsEditor,
  watch: WatchSettingsEditor,
};
