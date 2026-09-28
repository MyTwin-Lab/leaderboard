"use client";

import { useState } from "react";

/**
 * Les réglages du module watch, dans l'onglet Modules (admin) : le contact
 * OpenAlex — recommandé pour le polite pool —, les domaines cherchés par
 * défaut, le seuil high-impact, la taille de page et le TTL du cache.
 *
 * Chaque champ s'enregistre à la sortie (blur) ; la validation fine est celle
 * du schéma du module (`modules/watch/settings.ts`), dont le message revient
 * par la route.
 */

interface ModuleEntryLike {
  key: string;
  label: string;
  description: string | null;
  enabled: boolean;
  settings: Record<string, unknown>;
}

interface WatchSettingsProps {
  settings: Record<string, unknown>;
  onSaved(entry: ModuleEntryLike): void;
  save(settings: Record<string, unknown>): Promise<ModuleEntryLike>;
}

const INPUT_CLASS =
  "shrink-0 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-white focus:border-brandCP/40 focus:outline-none";

function numberOf(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function domainsOf(value: unknown): string {
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string").join(", ") : "4";
}

function Row({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm text-white/70">{label}</p>
        <p className="mt-0.5 text-xs text-white/35">{hint}</p>
      </div>
      {children}
    </div>
  );
}

export function WatchSettings({ settings, onSaved, save }: WatchSettingsProps) {
  const savedMailto = typeof settings.openalex_mailto === "string" ? settings.openalex_mailto : "";
  const savedDomains = domainsOf(settings.default_domain_ids);
  const savedThreshold = numberOf(settings.high_impact_threshold, 9);
  const savedPageSize = numberOf(settings.page_size, 25);
  const savedTtl = numberOf(settings.cache_ttl_seconds, 600);

  const [mailto, setMailto] = useState(savedMailto);
  const [domains, setDomains] = useState(savedDomains);
  const [threshold, setThreshold] = useState(String(savedThreshold));
  const [pageSize, setPageSize] = useState(String(savedPageSize));
  const [ttl, setTtl] = useState(String(savedTtl));
  const [error, setError] = useState<string | null>(null);

  const commit = async (patch: Record<string, unknown>, revert: () => void) => {
    setError(null);
    try {
      onSaved(await save(patch));
    } catch (e) {
      revert();
      setError(e instanceof Error ? e.message : "Failed to save");
    }
  };

  const commitMailto = () => {
    const next = mailto.trim();
    if (next === savedMailto) return;
    void commit({ openalex_mailto: next }, () => setMailto(savedMailto));
  };

  const commitDomains = () => {
    const ids = domains
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    if (ids.length === 0 || ids.some((id) => !/^\d+$/.test(id))) {
      setDomains(savedDomains);
      setError("Domain ids are whole numbers separated by commas (4 = Health Sciences)");
      return;
    }
    if (ids.join(", ") === savedDomains) return;
    void commit({ default_domain_ids: ids }, () => setDomains(savedDomains));
  };

  const commitNumber = (
    raw: string,
    saved: number,
    key: string,
    check: (value: number) => string | null,
    reset: (value: string) => void,
  ) => {
    const value = Number(raw);
    const problem = raw.trim() === "" || !Number.isFinite(value) ? "Enter a number" : check(value);
    if (problem) {
      reset(String(saved));
      setError(problem);
      return;
    }
    if (value === saved) return;
    void commit({ [key]: value }, () => reset(String(saved)));
  };

  return (
    <div className="space-y-3">
      <Row label="OpenAlex contact email" hint="Recommended: earns OpenAlex's polite pool (faster, less throttled)">
        <input
          type="email"
          value={mailto}
          placeholder="lab@example.org"
          onChange={(e) => setMailto(e.target.value)}
          onBlur={commitMailto}
          className={`${INPUT_CLASS} w-56`}
        />
      </Row>
      <Row label="Default domains" hint="OpenAlex domain ids searched by default (4 = Health Sciences)">
        <input
          type="text"
          value={domains}
          onChange={(e) => setDomains(e.target.value)}
          onBlur={commitDomains}
          className={`${INPUT_CLASS} w-28 text-right`}
        />
      </Row>
      <Row label="High-impact threshold" hint="Journal 2-year mean citedness at or above which a journal counts as high-impact">
        <input
          type="number"
          min={0}
          step={0.5}
          value={threshold}
          onChange={(e) => setThreshold(e.target.value)}
          onBlur={() =>
            commitNumber(
              threshold,
              savedThreshold,
              "high_impact_threshold",
              (value) => (value < 0 || value > 1000 ? "Threshold must be between 0 and 1000" : null),
              setThreshold,
            )
          }
          className={`${INPUT_CLASS} w-20 text-right`}
        />
      </Row>
      <Row label="Results per page" hint="Between 1 and 50">
        <input
          type="number"
          min={1}
          max={50}
          value={pageSize}
          onChange={(e) => setPageSize(e.target.value)}
          onBlur={() =>
            commitNumber(
              pageSize,
              savedPageSize,
              "page_size",
              (value) => (!Number.isInteger(value) || value < 1 || value > 50 ? "Page size must be a whole number between 1 and 50" : null),
              setPageSize,
            )
          }
          className={`${INPUT_CLASS} w-20 text-right`}
        />
      </Row>
      <Row label="Cache TTL (seconds)" hint="How long a search answer is reused before asking OpenAlex again">
        <input
          type="number"
          min={0}
          max={86400}
          value={ttl}
          onChange={(e) => setTtl(e.target.value)}
          onBlur={() =>
            commitNumber(
              ttl,
              savedTtl,
              "cache_ttl_seconds",
              (value) => (!Number.isInteger(value) || value < 0 || value > 86_400 ? "TTL must be a whole number of seconds up to 86400" : null),
              setTtl,
            )
          }
          className={`${INPUT_CLASS} w-24 text-right`}
        />
      </Row>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
