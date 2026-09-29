'use client';

import { useEffect, useState, type ComponentType, type SVGProps } from 'react';
import { ArrowLeft, AlertCircle, Box, Database, FlaskConical, Loader2, PlayCircle } from 'lucide-react';
import { GitHubIcon } from '@/components/ui/GitHubIcon';
import { useToast } from '@/components/ui/Toast';
import type { EvaluationGridFull } from '@packages/database-service/domain/entities';

import '@/components/vitrine/forms-vitrine.css';
import './evaluation-grids-vitrine.css';

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

/** Le banc d'essai d'une grille — sous la racine vitrine du profil, sur le vocabulaire commun des formulaires. */
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
      <button type="button" onClick={onBack} className="v-back">
        <ArrowLeft />
        Back to grid
      </button>

      <div className="v-eg-test-head">
        <div className="v-drawer-icon">
          <FlaskConical />
        </div>
        <div>
          <h2 className="v-eg-name">Test grid{grid ? `: ${grid.name}` : ''}</h2>
          <p className="v-help" data-size="xs">
            Runs 5 evaluations in parallel on the same real content and measures how consistent the scores are.
          </p>
        </div>
      </div>

      {noCategoriesYet && (
        <div className="v-alert" data-tone="warning">
          <AlertCircle />
          <span>Add at least one category to this grid before testing it.</span>
        </div>
      )}

      {/* Form */}
      <div className="v-section" style={{ gap: '1rem' }}>
        <div className="v-field">
          <span className="v-label">Source</span>
          <div className="v-choices">
            {SOURCE_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSourceType(opt.value)}
                  className="v-choice"
                  data-on={sourceType === opt.value ? 'true' : 'false'}
                >
                  <Icon />
                  <span className="v-choice-text">
                    <span className="v-choice-name">{opt.label}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <label className="v-field">
          <span className="v-label">URL</span>
          <input
            value={sourceUrl}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder={SOURCE_OPTIONS.find((o) => o.value === sourceType)?.placeholder}
          />
        </label>

        {sourceType === 'github' && (
          <label className="v-field">
            <span className="v-label">Branch override (optional)</span>
            <input
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder="Leave empty to use the URL's branch, or the repo's default"
            />
          </label>
        )}

        <label className="v-field">
          <span className="v-label">Title (optional)</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Derived from the URL if left empty" />
        </label>

        <label className="v-field">
          <span className="v-label">Challenge context (optional, free text)</span>
          <textarea
            value={contextNote}
            onChange={(e) => setContextNote(e.target.value)}
            rows={3}
            placeholder="Describe the challenge this contribution would belong to - given to the evaluator as extra context."
          />
        </label>

        {error && <p className="v-alert">{error}</p>}

        <div>
          <button type="button" className="v-btn" onClick={handleRun} disabled={!canRun}>
            {running ? <Loader2 className="v-spin" /> : <PlayCircle />}
            {running ? 'Running 5 evaluations…' : 'Run test'}
          </button>
        </div>
      </div>

      {result && <TestRunResults result={result} />}
    </div>
  );
}

/* ================================================================== */
/*  Results                                                             */
/* ================================================================== */

function determinismTone(score: number) {
  if (score >= 80) return 'good';
  if (score >= 50) return 'medium';
  return 'poor';
}

function TestRunResults({ result }: { result: TestRunResponse }) {
  return (
    <div className="animate-fade-up space-y-4">
      {result.warning && (
        <div className="v-alert" data-tone="warning">
          <AlertCircle />
          <span>{result.warning}</span>
        </div>
      )}

      <div className="v-eg-det" data-tone={determinismTone(result.determinism.score)}>
        <div>
          <p className="v-eg-det-label">Determinism score</p>
          <p className="v-eg-det-score">{result.determinism.score}%</p>
        </div>
        <div className="v-eg-det-side">
          <p>
            Global score: {result.determinism.mean} ± {result.determinism.stddev}
          </p>
          {result.failedCount > 0 && <p>{result.failedCount} run(s) failed</p>}
        </div>
      </div>

      <div className="v-section">
        <h3 className="v-section-title">Individual runs</h3>
        <div className="flex flex-wrap gap-2">
          {result.runs.map((run, i) => (
            <span key={i} className="v-eg-run">
              Run {i + 1}: <strong>{Math.round(run.globalScore)}</strong>
            </span>
          ))}
        </div>
      </div>

      <div className="v-section">
        <h3 className="v-section-title">Per-criterion consistency</h3>
        <div className="v-rows">
          {result.perCriterion.map((c) => (
            <div key={c.criterion} className="v-row" data-quiet="true">
              <div className="v-row-text">
                <span className="v-row-title">{c.criterion}</span>
              </div>
              <span className="v-row-meta">{c.values.join(', ')}</span>
              <span className="v-row-meta">
                avg {c.mean} · σ {c.stddev}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
