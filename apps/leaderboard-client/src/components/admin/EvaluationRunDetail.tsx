'use client';

import { X, AlertCircle, CheckCircle, Clock, Zap } from 'lucide-react';
import { Modal } from '@/components/vitrine/Modal';
import { runHandler } from '@/components/admin/EvaluationRunList';
import type { EvaluationRun } from '../../../../../packages/database-service/domain/entities';

interface EvaluationRunWithChallenge extends EvaluationRun {
  challengeTitle?: string;
}

interface EvaluationRunDetailProps {
  run: EvaluationRunWithChallenge;
  onClose: () => void;
}

const empty = <span style={{ color: 'var(--v-subtle)', fontStyle: 'italic' }}>-</span>;

function formatDate(d?: Date | string) {
  if (!d) return empty;
  return new Date(d).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function formatDuration(ms?: number) {
  if (!ms) return empty;
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

/** La couleur de la pastille de statut, dans les tons du vocabulaire vitrine. */
const statusTone: Record<string, string> = {
  succeeded: 'success',
  failed: 'danger',
  running: 'warning',
  pending: 'muted',
  canceled: 'muted',
};

const statusIcons: Record<string, React.ReactNode> = {
  succeeded: <CheckCircle />,
  failed: <AlertCircle />,
  running: <Clock className="animate-pulse" />,
  pending: <Clock />,
  canceled: <X />,
};

/** Le détail d'un run d'évaluation, en lecture. Sur la modale vitrine, en grille de définitions. */
export function EvaluationRunDetail({ run, onClose }: EvaluationRunDetailProps) {
  const handler = runHandler(run);
  const tone = statusTone[run.status] ?? 'muted';

  return (
    <Modal
      open
      onClose={onClose}
      title="Run Details"
      subtitle={<span className="v-badge" data-tone={tone}>{run.status}</span>}
      icon={statusIcons[run.status]}
      tone={run.status === 'failed' ? 'danger' : 'accent'}
      actions={
        <button type="button" className="v-btn-quiet" onClick={onClose}>
          Close
        </button>
      }
    >
      <dl className="v-dl">
        <dt>Run ID</dt>
        <dd><code className="v-code">{run.uuid}</code></dd>

        <dt>Challenge</dt>
        <dd>
          {run.challengeTitle ?? (run.challenge_id
            ? <code className="v-code">{run.challenge_id}</code>
            : empty)}
        </dd>

        {run.meta?.subject && (
          <>
            <dt>Subject</dt>
            <dd>
              {run.meta.subject.title}
              <code className="v-code" style={{ marginLeft: '0.35rem' }}>{run.meta.subject.ref.slice(0, 8)}…</code>
            </dd>
          </>
        )}

        <dt>Flow</dt>
        <dd className="flex items-center gap-1.5">
          <span className="v-badge">{run.trigger_type}</span>
          {handler && <code className="v-code">{handler}</code>}
        </dd>

        {run.meta?.gridSlug && (
          <>
            <dt>Grid</dt>
            <dd><code className="v-code">{run.meta.gridSlug}</code></dd>
          </>
        )}

        {run.meta?.bundleSource && (
          <>
            <dt>Bundle source</dt>
            <dd><code className="v-code">{run.meta.bundleSource}</code></dd>
          </>
        )}

        {run.window_start && run.window_end && (
          <>
            <dt>Window</dt>
            <dd>
              <code className="v-code">
                {new Date(run.window_start).toLocaleDateString('fr-FR')} → {new Date(run.window_end).toLocaleDateString('fr-FR')}
              </code>
            </dd>
          </>
        )}

        <dt>Started at</dt>
        <dd>{formatDate(run.started_at)}</dd>

        <dt>Finished at</dt>
        <dd>{formatDate(run.finished_at)}</dd>

        <dt>Duration</dt>
        <dd className="flex items-center gap-1.5">
          <Zap style={{ width: '0.75rem', height: '0.75rem', color: 'var(--v-accent)' }} />
          {formatDuration(run.meta?.durationMs)}
        </dd>

        {run.meta?.globalScore !== undefined && (
          <>
            <dt>Score</dt>
            <dd style={{ fontWeight: 600, color: 'var(--v-accent-dark)' }}>{run.meta.globalScore.toFixed(2)} / 9</dd>
          </>
        )}

        <dt>Contributions</dt>
        <dd>
          {run.meta?.contributionCount !== undefined
            ? <span style={{ fontWeight: 600, color: 'var(--v-accent-dark)' }}>{run.meta.contributionCount}</span>
            : empty}
        </dd>

        {run.meta?.evaluatorVersion && (
          <>
            <dt>Evaluator version</dt>
            <dd><code className="v-code">{run.meta.evaluatorVersion}</code></dd>
          </>
        )}

        {run.meta?.gridVersion && (
          <>
            <dt>Grid version</dt>
            <dd><code className="v-code">v{run.meta.gridVersion}</code></dd>
          </>
        )}
      </dl>

      {/* Error block */}
      {run.status === 'failed' && (run.error_code || run.error_message) && (
        <div className="v-alert">
          <AlertCircle />
          <span>
            {run.error_code && <code className="v-code" style={{ display: 'block', marginBottom: '0.25rem' }}>{run.error_code}</code>}
            {run.error_message}
          </span>
        </div>
      )}
    </Modal>
  );
}
