"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronRight, FileClock, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Toggle";
import { formatCP } from "@/lib/formatters";

interface DigestCounts {
  new_contributions: number;
  new_challenges: number;
  completed_challenges: number;
  new_contributors: number;
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
    <div className="mt-4 first:mt-0">
      <h4 className="text-[11px] font-semibold uppercase tracking-widest text-white/30">{title}</h4>
      {empty
        ? <p className="mt-1.5 text-xs text-white/25">Nothing in this period</p>
        : <div className="mt-1.5 space-y-1.5">{children}</div>}
    </div>
  );
}

function Row({ left, right }: { left: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <div className="min-w-0 text-white/70">{left}</div>
      {right !== undefined && <div className="shrink-0 text-xs text-white/40">{right}</div>}
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

  if (error) return <p className="mt-3 text-xs text-red-400">{error}</p>;
  if (!payload) return <p className="mt-3 text-xs text-white/25">Loading…</p>;

  return (
    <div className="mt-3 border-t border-white/[0.06] pt-3">
      <Section title="New contributions" empty={payload.new_contributions.length === 0}>
        {payload.new_contributions.map((c) => (
          <Row
            key={c.contribution_id}
            left={
              <>
                <span className="text-white/80">{c.title}</span>
                <span className="text-white/35"> — {c.challenge_title}</span>
                <span className="block text-xs text-white/35">
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
                <span className="text-white/80">{r.full_name}</span>
                <span className="text-white/35"> — {r.challenge_title}</span>
                <span className="block text-xs text-white/30">
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
                <span className="text-white/80">{ch.title}</span>
                <span className="text-white/35"> — {ch.project_title || "no project"}</span>
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
            left={<span className="text-white/80">{ch.title}</span>}
            right={`${formatCP(ch.cp_awarded)} of ${formatCP(ch.reward_pool)}`}
          />
        ))}
      </Section>

      <Section title="New contributors" empty={payload.new_contributors.length === 0}>
        {payload.new_contributors.map((u) => (
          <Row
            key={u.user_id}
            left={<span className="text-white/80">{u.full_name}</span>}
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
      const res = await fetch("/api/admin/digests/generate", { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to generate");
      await loadDigests();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/30">
          Digest
        </h2>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3.5">
            <div className="flex items-center gap-3 min-w-0">
              <FileClock className="h-4 w-4 text-white/50" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-white">Automatic generation</p>
                <p className="text-xs text-white/35 mt-0.5">
                  A daily check generates a digest once the interval has elapsed
                </p>
              </div>
            </div>
            <Toggle enabled={enabled} onChange={toggleEnabled} />
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3.5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-white">Interval</p>
              <p className="text-xs text-white/35 mt-0.5">Days between two automatic digests</p>
            </div>
            <input
              type="number"
              min={1}
              max={365}
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              onBlur={commitFrequency}
              className="w-20 shrink-0 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-right text-sm text-white focus:border-brandCP/40 focus:outline-none"
            />
          </div>
        </div>

        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between gap-4">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-white/30">
            History
          </h2>
          <Button size="sm" onClick={generateNow} disabled={generating}>
            <RefreshCw className={`h-3.5 w-3.5 ${generating ? "animate-spin" : ""}`} />
            {generating ? "Generating…" : "Generate now"}
          </Button>
        </div>

        {digests === null && <p className="text-xs text-white/25">Loading…</p>}

        {digests?.length === 0 && (
          <p className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-6 text-center text-xs text-white/30">
            No digest yet. Enable automatic generation, or generate one now.
          </p>
        )}

        <div className="space-y-2">
          {digests?.map((d) => {
            const isOpen = expanded === d.uuid;
            const total = Object.values(d.counts).reduce((a, b) => a + b, 0);
            return (
              <div
                key={d.uuid}
                className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3"
              >
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : d.uuid)}
                  className="flex w-full items-center justify-between gap-3 text-left"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white">
                      {formatDate(d.period_start)} → {formatDate(d.period_end)}
                    </p>
                    <p className="mt-0.5 text-xs text-white/35">
                      {total} {total === 1 ? "entry" : "entries"} · {d.trigger_source}
                    </p>
                  </div>
                  <ChevronRight
                    className={`h-4 w-4 shrink-0 text-white/30 transition-transform ${isOpen ? "rotate-90" : ""}`}
                  />
                </button>
                {isOpen && <DigestDetail id={d.uuid} />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
