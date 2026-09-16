'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download, Loader2, Upload } from 'lucide-react';
import { flowActionUrl } from '@/lib/challengeActions';

interface Overview {
  items: { total: number; open: number; labeled: number; contested: number };
  golds: number;
  k: number;
  options: { key: string; label: string }[];
  pool: { pool: number; distributed: number; remaining: number };
  annotators: {
    user_id: string;
    name: string;
    labels: number;
    gold_seen: number;
    gold_correct: number;
    accuracy: number | null;
    cp: number;
  }[];
  contested: { resource_id: string; image_url: string | null; tally: Record<string, number> }[];
}

function fgAt(opacity: number) {
  return `color-mix(in srgb, var(--foreground) ${Math.round(opacity * 100)}%, transparent)`;
}

const CARD = 'space-y-3 rounded-[18px] border border-white/10 bg-white/[0.02] p-4';
const HEADING = 'text-[10px] font-semibold uppercase tracking-widest';

function ImportDropzone({
  challengeId, kind, title, columns, onImported,
}: { challengeId: string; kind: 'items' | 'golds'; title: string; columns: string; onImported(): void }) {
  const [status, setStatus] = useState<{ tone: 'ok' | 'error'; text: string; details?: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch(flowActionUrl(challengeId, 'batches'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, csv: await file.text() }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setStatus({ tone: 'error', text: body?.error ?? `Import failed (${res.status})`, details: body?.details });
        return;
      }
      setStatus({ tone: 'ok', text: `${body.created} ${kind} imported from ${file.name}` });
      onImported();
    } finally {
      setBusy(false);
    }
  };

  return (
    <label
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); void upload(e.dataTransfer.files[0]); }}
      className={`block cursor-pointer rounded-xl border border-dashed px-4 py-5 text-center transition ${dragging ? 'border-brandCP/60 bg-brandCP/[0.04]' : 'border-white/15'}`}
    >
      <input type="file" accept=".csv,text/csv" className="hidden" onChange={e => { void upload(e.target.files?.[0]); e.target.value = ''; }} />
      <p className="flex items-center justify-center gap-2 text-sm font-medium" style={{ color: fgAt(0.75) }}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} {title}
      </p>
      <p className="mt-1 text-[11px]" style={{ color: fgAt(0.35) }}>CSV with columns {columns}</p>
      {status && (
        <div className={`mt-2 text-left text-[11px] ${status.tone === 'ok' ? 'text-emerald-300' : 'text-red-300'}`}>
          <p>{status.text}</p>
          {status.details?.map(detail => <p key={detail}>{detail}</p>)}
        </div>
      )}
    </label>
  );
}

/** La campagne côté admin et manager : import, avancement, qualité des annotateurs, contestés, export. */
export function AnnotationCampaignPanel({ challengeId }: { challengeId: string }) {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(flowActionUrl(challengeId, 'overview'));
    setData(res.ok ? await res.json() : null);
    setLoading(false);
  }, [challengeId]);

  useEffect(() => { void load(); }, [load]);

  const resolve = async (resourceId: string, value: string) => {
    setResolving(resourceId);
    try {
      await fetch(flowActionUrl(challengeId, `items/${resourceId}/resolve`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value }),
      });
      await load();
    } finally {
      setResolving(null);
    }
  };

  const labelOf = (key: string) => data?.options.find(o => o.key === key)?.label ?? key;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <ImportDropzone challengeId={challengeId} kind="items" title="Import items" columns="image_url, class (standard | sensitive)" onImported={load} />
        <ImportDropzone challengeId={challengeId} kind="golds" title="Import hidden checks (golds)" columns="image_url, expected (an option key)" onImported={load} />
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs" style={{ color: fgAt(0.35) }}>
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
        </div>
      ) : !data ? (
        <p className="text-xs" style={{ color: fgAt(0.4) }}>The campaign could not be loaded.</p>
      ) : (
        <>
          <div className={CARD}>
            <div className="flex items-center justify-between">
              <p className={HEADING} style={{ color: fgAt(0.3) }}>Progress</p>
              <a
                href={flowActionUrl(challengeId, 'export')}
                className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs"
                style={{ color: fgAt(0.7) }}
              >
                <Download className="h-3.5 w-3.5" /> Export labels (CSV)
              </a>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5" style={{ color: fgAt(0.7) }}>
              <p><b>{data.items.labeled}</b> / {data.items.total} labeled</p>
              <p><b>{data.items.open}</b> open</p>
              <p><b>{data.items.contested}</b> contested</p>
              <p><b>{data.golds}</b> hidden checks</p>
              <p><b>{data.pool.remaining.toLocaleString()}</b> / {data.pool.pool.toLocaleString()} CP left</p>
            </div>
          </div>

          <div className={CARD}>
            <p className={HEADING} style={{ color: fgAt(0.3) }}>Annotators</p>
            {data.annotators.length === 0 ? (
              <p className="text-xs" style={{ color: fgAt(0.4) }}>No label yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs" style={{ color: fgAt(0.65) }}>
                  <thead style={{ color: fgAt(0.35) }}>
                    <tr>
                      <th className="py-1.5 font-medium">Annotator</th>
                      <th className="py-1.5 font-medium">Labels</th>
                      <th className="py-1.5 font-medium">Hidden checks</th>
                      <th className="py-1.5 font-medium">Accuracy</th>
                      <th className="py-1.5 font-medium">Net CP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.annotators.map(a => (
                      <tr key={a.user_id} className="border-t border-white/[0.06]">
                        <td className="py-1.5">{a.name}</td>
                        <td className="py-1.5">{a.labels}</td>
                        <td className="py-1.5">{a.gold_correct} / {a.gold_seen}</td>
                        <td className="py-1.5">{a.accuracy == null ? '—' : `${Math.round(a.accuracy * 100)}%`}</td>
                        <td className="py-1.5">{a.cp}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className={CARD}>
            <p className={HEADING} style={{ color: fgAt(0.3) }}>Contested items</p>
            {data.contested.length === 0 ? (
              <p className="text-xs" style={{ color: fgAt(0.4) }}>Nothing to settle.</p>
            ) : (
              <div className="space-y-3">
                {data.contested.map(item => (
                  <div key={item.resource_id} className="flex flex-col gap-3 rounded-xl border border-white/[0.06] p-3 sm:flex-row sm:items-center">
                    {item.image_url && (
                      // eslint-disable-next-line @next/next/no-img-element -- images hébergées ailleurs
                      <img src={item.image_url} alt="Contested item" referrerPolicy="no-referrer" className="h-24 w-24 rounded-lg bg-black/40 object-contain" />
                    )}
                    <div className="flex-1 space-y-2">
                      <p className="text-[11px]" style={{ color: fgAt(0.45) }}>
                        {Object.entries(item.tally).map(([key, count]) => `${labelOf(key)} × ${count}`).join(' · ')}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {data.options.map(option => (
                          <button
                            key={option.key}
                            type="button"
                            disabled={resolving === item.resource_id}
                            onClick={() => resolve(item.resource_id, option.key)}
                            className="rounded-lg border border-white/15 px-3 py-1.5 text-xs disabled:opacity-40"
                            style={{ color: fgAt(0.75) }}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
