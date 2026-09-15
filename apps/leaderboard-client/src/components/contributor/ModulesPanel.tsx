"use client";

import { useState } from "react";
import { Toggle } from "@/components/ui/Toggle";
import { moduleIcon, moduleSettingsEditors, type ModuleEntry } from "@/distribution/modules/settings";

/**
 * L'écran des modules (onglet admin) : chaque module installé, son
 * interrupteur, et l'éditeur de réglages que la distribution lui donne.
 * Désactivé, un module disparaît de l'interface et ses routes répondent 404 ;
 * ses onglets propres (le digest) se masquent au prochain chargement.
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
    <div className="space-y-3">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/30">Modules</h2>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {entries.length === 0 && <p className="text-xs text-white/30">No module installed.</p>}
      {entries.map((entry) => {
        const Editor = moduleSettingsEditors[entry.key];
        return (
          <div key={entry.key} className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3.5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                {moduleIcon(entry.key)}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white">{entry.label}</p>
                  {entry.description && <p className="mt-0.5 text-xs text-white/35">{entry.description}</p>}
                </div>
              </div>
              <div className={`shrink-0 transition-opacity ${saving === entry.key ? "opacity-50" : ""}`}>
                <Toggle enabled={entry.enabled} onChange={(value) => void toggle(entry, value)} />
              </div>
            </div>
            {Editor && (
              <div className="mt-3 border-t border-white/[0.06] pt-3">
                <Editor settings={entry.settings} onSaved={replace} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
