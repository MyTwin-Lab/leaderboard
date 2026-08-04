'use client';

import { useEffect, useState, type ComponentType, type SVGProps } from 'react';
import { ArrowLeft, AlertCircle, Box, Database, FlaskConical, Loader2, PlayCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { GitHubIcon } from '@/components/ui/GitHubIcon';
import { useToast } from '@/components/ui/Toast';
import type { EvaluationGridFull } from '@packages/database-service/domain/entities';

type SourceType = 'github' | 'kaggle_dataset' | 'kaggle_model';

interface RunScore {
  criterion: string;
  score: number;
  weight: number;
  comment?: string;
}
interface RunResult {
  globalScore: number;
  scores: RunScore[];
}
interface DeterminismStats {
  score: number;
  mean: number;
  stddev: number;
}
interface CriterionStats {
  criterion: string;
  mean: number;
  stddev: number;
  values: number[];
}
interface TestRunResponse {
  runs: RunResult[];
  failedCount: number;
  determinism: DeterminismStats;
  perCriterion: CriterionStats[];
  warning?: string;
}

const inputClass =
  'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-brandCP/50 focus:outline-none focus:ring-1 focus:ring-brandCP/50';

const SOURCE_OPTIONS: {
  value: SourceType;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  placeholder: string;
}[] = [
  {
    value: 'github',
    label: 'GitHub',
    icon: GitHubIcon,
    placeholder: 'https://github.com/owner/repo (also accepts /tree/branch, /commit/sha, /pull/123)',
  },
  {
    value: 'kaggle_dataset',
    label: 'Kaggle Dataset',
    icon: Database,
    placeholder: 'https://www.kaggle.com/datasets/owner/slug',
  },
  {
    value: 'kaggle_model',
    label: 'Kaggle Model',
    icon: Box,
    placeholder: 'https://www.kaggle.com/models/owner/slug',
  },
];

function detectSourceType(url: string): SourceType | null {
  if (/kaggle\.com\/datasets\//i.test(url)) return 'kaggle_dataset';
  if (/kaggle\.com\/models\//i.test(url)) return 'kaggle_model';
  if (/github\.com\//i.test(url) || /^[^\s/]+\/[^\s/]+$/.test(url.trim())) return 'github';
  return null;
}

interface GridTestRunProps {
  gridId: string;
  onBack: () => void;
}

export function GridTestRun({ gridId, onBack }: GridTestRunProps) {
  const [grid, setGrid] = useState<EvaluationGridFull | null>(null);
  const [loadingGrid, setLoadingGrid] = useState(true);

  const [sourceType, setSourceType] = useState<SourceType>('github');
  const [sourceUrl, setSourceUrl] = useState('');
  const [branch, setBranch] = useState('');
  const [title, setTitle] = useState('');
  const [contextNote, setContextNote] = useState('');

  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<TestRunResponse | null>(null);

  const toast = useToast();

  useEffect(() => {
    fetch(`/api/evaluation-grids/${gridId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setGrid(data))
      .catch(() => toast('Failed to load grid', 'error'))
      .finally(() => setLoadingGrid(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gridId]);

  const handleUrlChange = (value: string) => {
    setSourceUrl(value);
    const detected = detectSourceType(value);
    if (detected) setSourceType(detected);
  };

  const noCategoriesYet = !loadingGrid && !!grid && grid.categories.length === 0;
  const canRun = !!grid && grid.categories.length > 0 && sourceUrl.trim().length > 0 && !running;

  const handleRun = async () => {
    if (!sourceUrl.trim()) {
      setError('Paste a URL first.');
      return;
    }
    setRunning(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch(`/api/evaluation-grids/${gridId}/test-run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceType,
          sourceUrl: sourceUrl.trim(),
          branch: sourceType === 'github' && branch.trim() ? branch.trim() : undefined,
          title: title.trim() || undefined,
          contextNote: contextNote.trim() || undefined,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? 'Test run failed');
        return;
      }
      setResult(body as TestRunResponse);
    } catch {
      setError('Network error');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-xs text-white/40 transition-colors hover:text-white/70"
      >
        <ArrowLeft className="h-3 w-3" />
        Back to grid
      </button>

      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brandCP/15">
          <FlaskConical className="h-4 w-4 text-brandCP" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">Test grid{grid ? `: ${grid.name}` : ''}</h2>
          <p className="text-xs text-white/40">
            Runs 3 evaluations in parallel on the same real content and measures how consistent the scores are.
          </p>
        </div>
      </div>

      {noCategoriesYet && (
        <div className="flex items-center gap-2 rounded-xl border border-yellow-500/20 bg-yellow-500/[0.06] px-4 py-3 text-sm text-yellow-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Add at least one category to this grid before testing it.
        </div>
      )}

      {/* Form */}
      <div className="space-y-4 rounded-xl border border-white/[0.07] bg-white/[0.02] p-5">
        <div>
          <label className="mb-1.5 block text-xs text-white/50">Source</label>
          <div className="grid grid-cols-3 gap-2">
            {SOURCE_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const active = sourceType === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setSourceType(opt.value)}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-medium transition-all duration-200 ${
                    active
                      ? 'border-brandCP/40 bg-brandCP/10 text-brandCP ring-1 ring-brandCP/20'
                      : 'border-white/[0.06] bg-white/[0.02] text-white/50 hover:border-white/15'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs text-white/50">URL</label>
          <input
            value={sourceUrl}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder={SOURCE_OPTIONS.find((o) => o.value === sourceType)?.placeholder}
            className={inputClass}
          />
        </div>

        {sourceType === 'github' && (
          <div>
            <label className="mb-1 block text-xs text-white/50">Branch override (optional)</label>
            <input
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder="Leave empty to use the URL's branch, or the repo's default"
              className={inputClass}
            />
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs text-white/50">Title (optional)</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Derived from the URL if left empty"
            className={inputClass}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs text-white/50">Challenge context (optional, free text)</label>
          <textarea
            value={contextNote}
            onChange={(e) => setContextNote(e.target.value)}
            rows={3}
            placeholder="Describe the challenge this contribution would belong to — given to the evaluator as extra context."
            className={inputClass}
          />
        </div>

        {error && (
          <p className="rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-sm text-red-400">{error}</p>
        )}

        <Button onClick={handleRun} disabled={!canRun}>
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
          {running ? 'Running 3 evaluations…' : 'Run test'}
        </Button>
      </div>

      {result && <TestRunResults result={result} />}
    </div>
  );
}

/* ================================================================== */
/*  Results                                                             */
/* ================================================================== */

function determinismColor(score: number) {
  if (score >= 80) return 'text-green-400 bg-green-500/10 border-green-500/20';
  if (score >= 50) return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
  return 'text-red-400 bg-red-500/10 border-red-500/20';
}

function TestRunResults({ result }: { result: TestRunResponse }) {
  return (
    <div className="animate-fade-up space-y-4">
      {result.warning && (
        <div className="flex items-center gap-2 rounded-xl border border-yellow-500/20 bg-yellow-500/[0.06] px-4 py-3 text-sm text-yellow-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {result.warning}
        </div>
      )}

      <div className={`flex items-center justify-between rounded-xl border p-5 ${determinismColor(result.determinism.score)}`}>
        <div>
          <p className="text-xs uppercase tracking-widest opacity-70">Determinism score</p>
          <p className="text-3xl font-bold">{result.determinism.score}%</p>
        </div>
        <div className="text-right text-xs opacity-70">
          <p>
            Global score: {result.determinism.mean} ± {result.determinism.stddev}
          </p>
          {result.failedCount > 0 && <p className="mt-1">{result.failedCount} run(s) failed</p>}
        </div>
      </div>

      <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/30">Individual runs</h3>
        <div className="flex flex-wrap gap-2">
          {result.runs.map((run, i) => (
            <span key={i} className="rounded-lg bg-white/[0.04] px-3 py-1.5 text-sm text-white/70">
              Run {i + 1}: <span className="font-semibold text-white">{Math.round(run.globalScore)}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/30">Per-criterion consistency</h3>
        <div className="space-y-1.5">
          {result.perCriterion.map((c) => (
            <div
              key={c.criterion}
              className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg bg-white/[0.02] px-3 py-2 text-sm"
            >
              <span className="text-white/80">{c.criterion}</span>
              <div className="flex items-center gap-3 text-xs text-white/40">
                <span>{c.values.join(', ')}</span>
                <span className="text-white/60">
                  avg {c.mean} · σ {c.stddev}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
