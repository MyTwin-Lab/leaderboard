'use client';

import { Database, Cpu, BrainCircuit, ExternalLink } from 'lucide-react';

/**
 * Dataset and model metrics for an ML challenge.
 *
 * Converged from two near-copies: this one is the challenge page's, which had
 * a Dataset card the manage view's lacked. Managers gain that card here.
 * Reads only `repoActivity`, so it needs no session and serves the public page
 * as it stands.
 */
// ─── ML Metrics chart ────────────────────────────────────────────────────────

function MetricsLineChart({ versions }: {
  versions: Array<{ versionNumber: number; metrics: { auc?: number; f1?: number; accuracy?: number } }>;
}) {
  const W = 320, H = 140;
  const PAD = { top: 12, right: 16, bottom: 28, left: 36 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const xs = versions.map(v => v.versionNumber);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const xRange = maxX - minX || 1;
  const toSVGX = (x: number) => PAD.left + ((x - minX) / xRange) * innerW;
  const toSVGY = (y: number) => PAD.top + (1 - y) * innerH;
  const LINES = [
    { key: 'auc'      as const, color: 'var(--color-brandCP, #6366f1)', label: 'AUC' },
    { key: 'f1'       as const, color: '#22c55e',                        label: 'F1' },
    { key: 'accuracy' as const, color: '#3b82f6',                        label: 'Accuracy' },
  ];
  const toPath = (key: 'auc' | 'f1' | 'accuracy') => {
    const pts = versions.filter(v => v.metrics[key] !== undefined);
    if (!pts.length) return '';
    return pts.map((v, i) => `${i === 0 ? 'M' : 'L'} ${toSVGX(v.versionNumber).toFixed(1)} ${toSVGY(v.metrics[key]!).toFixed(1)}`).join(' ');
  };
  return (
    <div className="overflow-x-auto">
      <svg width={W} height={H} className="text-white/20">
        {[0, 0.25, 0.5, 0.75, 1.0].map(t => (
          <g key={t}>
            <line x1={PAD.left} y1={toSVGY(t)} x2={PAD.left + innerW} y2={toSVGY(t)} stroke="currentColor" strokeWidth={0.5} strokeDasharray="2 3" />
            <text x={PAD.left - 4} y={toSVGY(t) + 4} textAnchor="end" fontSize={8} fill="currentColor">{t.toFixed(2)}</text>
          </g>
        ))}
        {versions.map(v => (
          <text key={v.versionNumber} x={toSVGX(v.versionNumber)} y={H - 8} textAnchor="middle" fontSize={8} fill="currentColor">v{v.versionNumber}</text>
        ))}
        {LINES.map(({ key, color }) => { const d = toPath(key); return d ? <path key={key} d={d} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" /> : null; })}
        {LINES.map(({ key, color }) => versions.filter(v => v.metrics[key] !== undefined).map(v => (
          <circle key={`${key}-${v.versionNumber}`} cx={toSVGX(v.versionNumber)} cy={toSVGY(v.metrics[key]!)} r={3} fill={color} />
        )))}
      </svg>
      <div className="mt-2 flex gap-4">
        {LINES.map(({ key, color, label }) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className="h-2 w-4 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-[10px] text-white/40">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Tab: ML Metrics ──────────────────────────────────────────────────────

export function ChallengeMetrics({ repoActivity }: { repoActivity: Record<string, any> | null }) {
  if (repoActivity === null) {
    return (
      <div className="space-y-4 animate-pulse">
        {[1, 2].map(i => <div key={i} className="h-24 rounded-xl bg-white/[0.03]" />)}
      </div>
    );
  }

  const datasetEntry = Object.values(repoActivity).find((a: any) => a?.type === 'kaggle_dataset');
  const modelEntry   = Object.values(repoActivity).find((a: any) => a?.type === 'kaggle_model');

  return (
    <div className="space-y-8">
      {/* Dataset card */}
      {datasetEntry?.datasetMeta && (() => {
        const meta = datasetEntry.datasetMeta;
        return (
          <div className="space-y-3">
            <h3 className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-white/30">
              <Database className="h-3.5 w-3.5 text-primary-100/35" />
              Dataset
            </h3>
            <div className="rounded-[14px] border border-white/[0.06] bg-white/[0.02] px-5 py-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-white">{meta.title}</p>
                {meta.url && (
                  <a href={meta.url} target="_blank" rel="noopener noreferrer"
                    className="flex shrink-0 items-center gap-1 text-xs text-brandCP hover:underline">
                    Kaggle <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              {meta.description && <p className="text-xs text-white/40 line-clamp-3">{meta.description}</p>}
              {meta.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {meta.tags.slice(0, 8).map((tag: string) => (
                    <span key={tag} className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[10px] text-white/40">{tag}</span>
                  ))}
                </div>
              )}
              {meta.lastUpdated && (
                <p className="text-[11px] text-white/25">
                  Updated {new Date(meta.lastUpdated).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              )}
            </div>
          </div>
        );
      })()}

      {/* Model metrics */}
      {modelEntry && (() => {
        const modelVersions: Array<{ ref: string; versions: any[] }> = modelEntry.modelVersions ?? [];
        return (
          <div className="space-y-4">
            <h3 className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-white/30">
              <Cpu className="h-3.5 w-3.5 text-primary-100/35" />
              Model Metrics
            </h3>
            {modelVersions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/[0.05] py-12 text-center">
                <p className="text-sm text-white/20">No model versions found</p>
              </div>
            ) : modelVersions.map(({ ref, versions }) => {
              const hasMetrics = versions.some(v =>
                v.metrics.auc !== undefined || v.metrics.f1 !== undefined || v.metrics.accuracy !== undefined
              );
              return (
                <div key={ref} className="rounded-[14px] border border-white/[0.06] bg-white/[0.02] px-5 py-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-white/70">{ref}</p>
                    <span className="text-[10px] text-white/25">{versions.length} version{versions.length !== 1 ? 's' : ''}</span>
                  </div>
                  {!hasMetrics ? (
                    <p className="text-xs text-white/25">No metrics found in model card</p>
                  ) : versions.length === 1 ? (
                    <div className="flex flex-wrap gap-3">
                      {(['auc', 'f1', 'accuracy'] as const).map(key => {
                        const val = versions[0].metrics[key];
                        if (val === undefined) return null;
                        return (
                          <div key={key} className="rounded-[14px] border border-white/[0.06] bg-white/[0.02] px-4 py-2 text-center">
                            <p className="text-[10px] uppercase tracking-widest text-white/30">{key.toUpperCase()}</p>
                            <p className="text-lg font-bold text-white">{val.toFixed(3)}</p>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <MetricsLineChart versions={versions} />
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}

      {!datasetEntry && !modelEntry && (
        <div className="rounded-xl border border-dashed border-white/[0.05] py-12 text-center">
          <BrainCircuit className="mx-auto mb-2 h-7 w-7 text-white/15" />
          <p className="text-sm text-white/20">No Kaggle data available for this challenge</p>
        </div>
      )}
    </div>
  );
}
