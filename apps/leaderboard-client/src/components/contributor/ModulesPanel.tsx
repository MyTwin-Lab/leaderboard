"use client";

import { useState } from "react";
import { moduleSettingsEditors, type ModuleEntry } from "@/distribution/modules/settings";

/**
 * L'écran des modules (onglet admin), à la matière de `Profile Vitrine.dc.html` :
 * chaque module installé sur une ligne « libellé + interrupteur », et sous
 * elle l'éditeur de réglages que la distribution lui donne. Désactivé, un
 * module disparaît de l'interface et ses routes répondent 404 ; ses onglets
 * propres (le digest) se masquent au prochain chargement.
 */
export function ModulesPanel({ initialModules }: { initialModules: ModuleEntry[] }) {
  const [entries, setEntries] = useState(initialModules);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const replace = (next: ModuleEntry) =>
    setEntries((prev) => prev.map((entry) => (entry.key === next.key ? { ...entry, ...next } : entry)));

  const toggle = async (entry: ModuleEntry, enabled: boolean) => {
    setSaving(entry.key);
    setError(null);
    replace({ ...entry, enabled });
    try {
      const res = await fetch(`/api/modules/${encodeURIComponent(entry.key)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Failed to save");
      replace(body as ModuleEntry);
    } catch (e) {
      replace(entry);
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(null);
    }
  };

  return (
    <>
      {error && <p className="v-pro-error">{error}</p>}
      {entries.length === 0 && <p className="v-pro-note">No module installed.</p>}
      {entries.map((entry) => {
        const Editor = moduleSettingsEditors[entry.key];
        return (
          <div key={entry.key} className="v-pro-mod">
            <div className="v-pro-switch-row">
              <div className="v-pro-switch-text">
                <span className="v-pro-switch-label">{entry.label}</span>
                {entry.description && <span className="v-pro-switch-desc">{entry.description}</span>}
              </div>
              <button
                type="button"
                onClick={() => void toggle(entry, !entry.enabled)}
                className="v-pro-toggle"
                data-on={entry.enabled}
                aria-label={`Toggle ${entry.label}`}
                aria-pressed={entry.enabled}
                style={saving === entry.key ? { opacity: 0.5 } : undefined}
              >
                <span />
              </button>
            </div>
            {Editor && (
              <div className="v-pro-mod-editor">
                <Editor settings={entry.settings} onSaved={replace} />
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
