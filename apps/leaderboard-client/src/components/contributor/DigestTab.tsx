"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronRight, RefreshCw } from "lucide-react";
import { formatCP } from "@/lib/formatters";

interface DigestCounts {
  new_contributions: number;
  new_challenges: number;
  completed_challenges: number;
  new_contributors: number;
  /** Toujours servi par la route, à 0 pour un payload v1 qui n'a pas la section. */
  new_sandboxes: number;
  cp_distributed: number;
}

interface DigestSummary {
  uuid: string;
  period_start: string;
  period_end: string;
  generated_at: string;
  trigger_source: "cron" | "manual";
  counts: DigestCounts;
}

interface DigestPayload {
  version: number;
  new_contributions: Array<{
    contribution_id: string;
    title: string;
    type: string;
    challenge_title: string;
    contributors: Array<{ user_id: string; full_name: string }>;
    reward_cp: number;
  }>;
  new_challenges: Array<{
    challenge_id: string; title: string; type: string;
    project_title: string; reward_pool: number;
  }>;
  completed_challenges: Array<{
    challenge_id: string; title: string; type: string;
    closed_at: string; reward_pool: number; cp_awarded: number;
  }>;
  new_contributors: Array<{
    user_id: string; full_name: string; role: string; joined_at: string;
  }>;
  /** Absente des payloads v1 : un digest figé avant cette section reste lisible. */
  new_sandboxes?: Array<{
    sandbox_id: string; title: string; type: string;
    author: { user_id: string; full_name: string }; star_count: number;
  }>;
  cp_distributed: Array<{
    user_id: string; full_name: string; challenge_title: string;
    total_cp: number; by_rule: Record<string, number>;
  }>;
}

interface Props {
  enabled: boolean;
  frequencyDays: number;
}

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit", month: "short", year: "numeric",
});

function formatDate(iso: string): string {
  return dateFmt.format(new Date(iso));
}

/** Une section vide s'affiche explicitement : un digest court est un résultat
 *  valide, une section absente se lirait comme un bug. */
function Section({ title, children, empty }: {
  title: string; children: React.ReactNode; empty: boolean;
}) {
  return (
    <div className="v-pro-digest-section">
      <h4 className="v-pro-label">{title}</h4>
      {empty
        ? <p className="v-pro-note">Nothing in this period</p>
        : <div className="v-pro-digest-rows">{children}</div>}
    </div>
  );
}

function Row({ left, right }: { left: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="v-pro-digest-row">
      <div>{left}</div>
      {right !== undefined && <div className="v-pro-digest-row-right">{right}</div>}
    </div>
  );
}

function DigestDetail({ id }: { id: string }) {
  const [payload, setPayload] = useState<DigestPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/digests/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed to load digest"))))
      .then((d) => { if (!cancelled) setPayload(d.payload); })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [id]);

  if (error) return <p className="v-pro-error">{error}</p>;
  if (!payload) return <p className="v-pro-note">Loading…</p>;

  return (
    <div className="v-pro-digest-detail">
      <Section title="New contributions" empty={payload.new_contributions.length === 0}>
        {payload.new_contributions.map((c) => (
          <Row
            key={c.contribution_id}
            left={
              <>
                <span className="v-pro-digest-strong">{c.title}</span>
                <span className="v-pro-digest-weak"> - {c.challenge_title}</span>
                <span className="v-pro-digest-sub">
                  {c.contributors.map((u) => u.full_name).join(", ")}
                </span>
              </>
            }
            right={formatCP(c.reward_cp)}
          />
        ))}
      </Section>

      <Section title="CP distributed" empty={payload.cp_distributed.length === 0}>
        {payload.cp_distributed.map((r) => (
          <Row
            key={`${r.user_id}-${r.challenge_title}`}
            left={
              <>
                <span className="v-pro-digest-strong">{r.full_name}</span>
                <span className="v-pro-digest-weak"> - {r.challenge_title}</span>
                <span className="v-pro-digest-sub">
                  {Object.entries(r.by_rule)
                    .map(([rule, pts]) => `${rule} ${pts > 0 ? "+" : ""}${pts}`)
                    .join(" · ")}
                </span>
              </>
            }
            right={formatCP(r.total_cp)}
          />
        ))}
      </Section>

      <Section title="New challenges" empty={payload.new_challenges.length === 0}>
        {payload.new_challenges.map((ch) => (
          <Row
            key={ch.challenge_id}
            left={
              <>
                <span className="v-pro-digest-strong">{ch.title}</span>
                <span className="v-pro-digest-weak"> - {ch.project_title || "no project"}</span>
              </>
            }
            right={`${ch.type} · ${formatCP(ch.reward_pool)} pool`}
          />
        ))}
      </Section>

      <Section title="Completed challenges" empty={payload.completed_challenges.length === 0}>
        {payload.completed_challenges.map((ch) => (
          <Row
            key={ch.challenge_id}
            left={<span className="v-pro-digest-strong">{ch.title}</span>}
            right={`${formatCP(ch.cp_awarded)} of ${formatCP(ch.reward_pool)}`}
          />
        ))}
      </Section>

      {/* Rendue seulement si le payload la porte : sur un digest v1 la clé est
          absente, et afficher « rien sur la période » mentirait — la section
          n'existait pas quand il a été généré. */}
      {payload.new_sandboxes && (
        <Section title="New sandboxes" empty={payload.new_sandboxes.length === 0}>
          {payload.new_sandboxes.map((sb) => (
            <Row
              key={sb.sandbox_id}
              left={
                <>
                  <span className="v-pro-digest-strong">{sb.title}</span>
                  <span className="v-pro-digest-weak"> - {sb.author.full_name}</span>
                </>
              }
              right={`${sb.star_count} ★`}
            />
          ))}
        </Section>
      )}

      <Section title="New contributors" empty={payload.new_contributors.length === 0}>
        {payload.new_contributors.map((u) => (
          <Row
            key={u.user_id}
            left={<span className="v-pro-digest-strong">{u.full_name}</span>}
            right={`${u.role} · ${formatDate(u.joined_at)}`}
          />
        ))}
      </Section>
    </div>
  );
}

export function DigestTab({ enabled: initialEnabled, frequencyDays: initialFrequency }: Props) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [frequency, setFrequency] = useState(String(initialFrequency));
  const [digests, setDigests] = useState<DigestSummary[] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loadDigests = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/digests");
      if (!res.ok) throw new Error("Failed to load the digest history");
      const body = await res.json();
      setDigests(body.digests);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load the digest history");
      setDigests([]);
    }
  }, []);

  useEffect(() => { void loadDigests(); }, [loadDigests]);

  const saveSettings = async (patch: Record<string, unknown>, rollback: () => void) => {
    setError(null);
    try {
      const res = await fetch("/api/admin/digest-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to save");
    } catch (e) {
      rollback();
      setError(e instanceof Error ? e.message : "Failed to save");
    }
  };

  const toggleEnabled = (value: boolean) => {
    setEnabled(value);
    void saveSettings({ digest_enabled: value }, () => setEnabled(!value));
  };

  const commitFrequency = () => {
    const days = Number(frequency);
    if (!Number.isInteger(days) || days < 1 || days > 365) {
      setFrequency(String(initialFrequency));
      setError("Frequency must be a whole number of days between 1 and 365");
      return;
    }
    void saveSettings({ digest_frequency_days: days }, () =>
      setFrequency(String(initialFrequency)),
    );
  };

  const generateNow = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/digests/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Vide = depuis la fin du dernier digest. Une date choisie impose la
        // borne basse, ce qui permet de rattraper une période qu'un digest
        // déjà généré aurait consommée.
        body: JSON.stringify(startDate ? { period_start: startDate } : {}),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to generate");
      await loadDigests();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <span className="v-pro-kicker">Digest</span>

      {/* Les deux réglages : l'automatisme, puis son intervalle. La carte
          teintée porte le premier — c'est lui qui décide si le reste sert. */}
      <div className="v-pro-switch-row" data-tone="mint">
        <div className="v-pro-switch-text">
          <span className="v-pro-switch-label">Automatic generation</span>
          <span className="v-pro-switch-desc">
            A daily check generates a digest once the interval has elapsed.
          </span>
        </div>
        <button
          onClick={() => toggleEnabled(!enabled)}
          className="v-pro-toggle"
          data-on={enabled}
          aria-label="Toggle automatic digests"
          aria-pressed={enabled}
        >
          <span />
        </button>
      </div>

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
            onBlur={commitFrequency}
          />
          <span className="v-pro-num-unit">days</span>
        </div>
      </div>

      {error && <p className="v-pro-error">{error}</p>}

      <div className="v-pro-head">
        <span className="v-pro-kicker">History</span>
        <div className="v-pro-digest-actions">
          <label className="v-pro-note" htmlFor="digest-start">From</label>
          <input
            id="digest-start"
            className="v-pro-input"
            style={{ width: "auto" }}
            type="date"
            value={startDate}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setStartDate(e.target.value)}
          />
          {startDate && (
            <button
              type="button"
              onClick={() => setStartDate("")}
              title="Back to the end of the last digest"
              className="v-pro-btn-text"
            >
              clear
            </button>
          )}
          <button onClick={generateNow} disabled={generating} className="v-pro-btn">
            <RefreshCw className={generating ? "animate-spin" : ""} />
            {generating ? "Generating…" : "Generate now"}
          </button>
        </div>
      </div>

      <p className="v-pro-note">
        {startDate
          ? `The digest will cover ${formatDate(`${startDate}T00:00:00.000Z`)} → now. Picking a start can overlap a period an earlier digest already covered.`
          : "Leave the date empty to start where the last digest ended."}
      </p>

      {digests === null && <p className="v-pro-note">Loading…</p>}

      {digests?.length === 0 && (
        <div className="v-pro-empty">
          <span className="v-pro-empty-title">No digest yet</span>
          <span className="v-pro-empty-sub">Enable automatic generation, or generate one now.</span>
        </div>
      )}

      <div className="v-pro-rows">
        {digests?.map((d) => {
          const isOpen = expanded === d.uuid;
          const total = Object.values(d.counts).reduce((a, b) => a + b, 0);
          return (
            <div key={d.uuid} className="v-pro-row" data-open={isOpen}>
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : d.uuid)}
                className="v-pro-row-btn"
              >
                <div className="v-pro-row-text">
                  <p className="v-pro-row-title">
                    {formatDate(d.period_start)} → {formatDate(d.period_end)}
                  </p>
                  <p className="v-pro-row-sub">
                    {total} {total === 1 ? "entry" : "entries"} · {d.trigger_source}
                  </p>
                </div>
                <ChevronRight className="v-pro-row-chev" />
              </button>
              {isOpen && (
                <div className="v-pro-row-body">
                  <DigestDetail id={d.uuid} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
