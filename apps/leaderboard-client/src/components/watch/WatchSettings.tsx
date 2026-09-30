"use client";

import { useState } from "react";

/**
 * Les réglages du module watch, dans l'onglet Modules (admin), à la matière du
 * profil vitrine : la sélection d'accueil de `/watch` (une recherche réglée,
 * ou les derniers jours — fenêtre et classement), le contact OpenAlex —
 * recommandé pour le polite pool —, les domaines cherchés par défaut, le seuil
 * high-impact, la taille de page et le TTL du cache.
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

function numberOf(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function domainsOf(value: unknown): string {
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string").join(", ") : "4";
}

function Row({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="v-pro-switch-row">
      <div className="v-pro-switch-text">
        <span className="v-pro-switch-label">{label}</span>
        <span className="v-pro-switch-desc">{hint}</span>
      </div>
      {children}
    </div>
  );
}

type SpotlightMode = "query" | "recent";
type SpotlightRanking = "impact" | "newest";

export function WatchSettings({ settings, onSaved, save }: WatchSettingsProps) {
  const savedMailto = typeof settings.openalex_mailto === "string" ? settings.openalex_mailto : "";
  const savedMode: SpotlightMode = settings.spotlight_mode === "query" ? "query" : "recent";
  const savedSpotlight = typeof settings.spotlight_query === "string" ? settings.spotlight_query : "mammography deep learning";
  const savedWindow = numberOf(settings.spotlight_window_days, 15);
  const savedRanking: SpotlightRanking = settings.spotlight_ranking === "newest" ? "newest" : "impact";
  const savedDomains = domainsOf(settings.default_domain_ids);
  const savedThreshold = numberOf(settings.high_impact_threshold, 9);
  const savedPageSize = numberOf(settings.page_size, 25);
  const savedTtl = numberOf(settings.cache_ttl_seconds, 600);

  const [mailto, setMailto] = useState(savedMailto);
  const [mode, setMode] = useState<SpotlightMode>(savedMode);
  const [spotlightQuery, setSpotlightQuery] = useState(savedSpotlight);
  const [windowDays, setWindowDays] = useState(String(savedWindow));
  const [ranking, setRanking] = useState<SpotlightRanking>(savedRanking);
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

  const commitMode = (next: SpotlightMode) => {
    setMode(next);
    if (next === savedMode) return;
    void commit({ spotlight_mode: next }, () => setMode(savedMode));
  };

  const commitRanking = (next: SpotlightRanking) => {
    setRanking(next);
    if (next === savedRanking) return;
    void commit({ spotlight_ranking: next }, () => setRanking(savedRanking));
  };

  const commitSpotlight = () => {
    const next = spotlightQuery.trim();
    if (next === savedSpotlight) return;
    void commit({ spotlight_query: next }, () => setSpotlightQuery(savedSpotlight));
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
    <>
      {/* La sélection d'accueil : figée côté serveur, renouvelée tous les
          « window » jours dans les deux modes. */}
      <Row label="Spotlight" hint="What /watch shows before any search: a search you set, or the last days">
        <select value={mode} onChange={(e) => commitMode(e.target.value as SpotlightMode)} className="v-pro-input" style={{ width: "auto" }}>
          <option value="recent">Last days</option>
          <option value="query">A search</option>
        </select>
      </Row>
      {mode === "query" && (
        <Row label="Spotlight search" hint="Its most relevant publications; empty = the newest of the last days">
          <input
            type="text"
            value={spotlightQuery}
            placeholder="mammography deep learning"
            maxLength={300}
            onChange={(e) => setSpotlightQuery(e.target.value)}
            onBlur={commitSpotlight}
            className="v-pro-input"
            style={{ width: "auto", flex: "0 1 18rem" }}
          />
        </Row>
      )}
      <Row
        label={mode === "recent" ? "Spotlight window" : "Spotlight refresh"}
        hint={
          mode === "recent"
            ? "The publications of the last N days; the selection is refreshed every N days"
            : "The selection is refreshed every N days"
        }
      >
        <div className="v-pro-num" data-fixed="true">
          <input
            type="number"
            min={1}
            max={365}
            value={windowDays}
            onChange={(e) => setWindowDays(e.target.value)}
            onBlur={() =>
              commitNumber(
                windowDays,
                savedWindow,
                "spotlight_window_days",
                (value) => (!Number.isInteger(value) || value < 1 || value > 365 ? "The window is a whole number of days, 1 to 365" : null),
                setWindowDays,
              )
            }
          />
          <span className="v-pro-num-unit">days</span>
        </div>
      </Row>
      {mode === "recent" && (
        <Row label="Spotlight ranking" hint="High impact: the most cited, from high-impact journals only. Recent: the newest">
          <select value={ranking} onChange={(e) => commitRanking(e.target.value as SpotlightRanking)} className="v-pro-input" style={{ width: "auto" }}>
            <option value="impact">High impact</option>
            <option value="newest">Recent</option>
          </select>
        </Row>
      )}
      <Row label="OpenAlex contact email" hint="Recommended: earns OpenAlex's polite pool (faster, less throttled)">
        <input
          type="email"
          value={mailto}
          placeholder="lab@example.org"
          onChange={(e) => setMailto(e.target.value)}
          onBlur={commitMailto}
          className="v-pro-input"
          style={{ width: "auto", flex: "0 1 16rem" }}
        />
      </Row>
      <Row label="Default domains" hint="OpenAlex domain ids searched by default (4 = Health Sciences)">
        <div className="v-pro-num" data-fixed="true">
          <input type="text" value={domains} onChange={(e) => setDomains(e.target.value)} onBlur={commitDomains} />
        </div>
      </Row>
      <Row label="High-impact threshold" hint="Journal 2-year mean citedness at or above which a journal counts as high-impact">
        <div className="v-pro-num" data-fixed="true">
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
          />
          <span className="v-pro-num-unit">citedness</span>
        </div>
      </Row>
      <Row label="Results per page" hint="Between 1 and 50">
        <div className="v-pro-num" data-fixed="true">
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
          />
          <span className="v-pro-num-unit">results</span>
        </div>
      </Row>
      <Row label="Cache TTL" hint="How long a search answer is reused before asking OpenAlex again">
        <div className="v-pro-num" data-fixed="true">
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
          />
          <span className="v-pro-num-unit">seconds</span>
        </div>
      </Row>
      {error && <p className="v-pro-error">{error}</p>}
    </>
  );
}
