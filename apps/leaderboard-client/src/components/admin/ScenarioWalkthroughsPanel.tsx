'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Loader2, Stethoscope } from 'lucide-react';
import { RESULT_META, type ScenarioResult } from '@/components/challenges/scenarioResult';

interface ScenarioStep { id: string; position: number; title: string }

interface StepFeedback {
  stepId: string;
  result: ScenarioResult;
  comment: string | null;
  medicalComment: string | null;
}

interface WalkthroughRun {
  id: string;
  contributionId: string;
  submitterName: string;
  endpointUrl: string | null;
  validatorId: string;
  validatorName: string;
  isMedicalPro: boolean;
  completedAt: string | null;
  globalFeedback: string | null;
  answeredCount: number;
  stepFeedbacks: StepFeedback[];
}

function fgAt(opacity: number) {
  return `color-mix(in srgb, var(--foreground) ${Math.round(opacity * 100)}%, transparent)`;
}

/** La ligne de marques : une walkthrough entière lisible d'un coup d'oeil. */
function MarkRow({ feedbacks }: { feedbacks: StepFeedback[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {feedbacks.map(f => {
        const meta = RESULT_META[f.result];
        return (
          <span
            key={f.stepId}
            title={meta.label}
            className={`flex h-6 w-6 items-center justify-center rounded-lg text-[11px] font-bold ${meta.bg} ${meta.text}`}
          >
            {meta.mark}
          </span>
        );
      })}
    </div>
  );
}

function RunRow({ run, steps, stepCount }: { run: WalkthroughRun; steps: Map<string, ScenarioStep>; stepCount: number }) {
  const [expanded, setExpanded] = useState(false);
  const completed = !!run.completedAt;
  const commented = run.stepFeedbacks.filter(f => f.comment || f.medicalComment);

  return (
    <div className="border-b border-white/[0.05] last:border-b-0">
      <button
        onClick={() => setExpanded(e => !e)}
        className="flex w-full flex-wrap items-center gap-2.5 px-4 py-3 text-left transition-colors hover:bg-white/[0.02]"
      >
        <span className="text-sm font-medium" style={{ color: fgAt(0.8) }}>{run.validatorName}</span>
        {run.isMedicalPro && (
          <span className="rounded-full bg-brandCP/10 px-2 py-0.5 text-[10px] font-bold text-brandCP">medical_pro</span>
        )}
        <span className="text-[11px]" style={{ color: fgAt(0.3) }}>
          {completed ? new Date(run.completedAt!).toLocaleDateString() : 'not finished'}
        </span>
        <span
          className={`ml-auto rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
            completed ? 'bg-green-500/15 text-green-400' : 'bg-amber-500/15 text-amber-400'
          }`}
        >
          {completed ? 'Completed' : `Draft · ${run.answeredCount}/${stepCount}`}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} style={{ color: fgAt(0.3) }} />
      </button>

      <div className="px-4 pb-3">
        <MarkRow feedbacks={run.stepFeedbacks} />
      </div>

      {expanded && (
        <div className="space-y-3 px-4 pb-4">
          {run.globalFeedback && (
            <p className="text-[13px] leading-relaxed" style={{ color: fgAt(0.6) }}>{run.globalFeedback}</p>
          )}

          {commented.length === 0 ? (
            <p className="text-xs" style={{ color: fgAt(0.25) }}>No comment on any individual step.</p>
          ) : (
            <div className="space-y-2">
              {commented.map(f => {
                const step = steps.get(f.stepId);
                const meta = RESULT_META[f.result];
                const number = step ? String(step.position + 1).padStart(2, '0') : '--';
                return (
                  <div key={f.stepId} className="space-y-1.5 rounded-[14px] border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                    <p className="flex items-center gap-2 text-[11px]">
                      <span className="font-mono" style={{ color: fgAt(0.3) }}>{number}</span>
                      <span style={{ color: fgAt(0.6) }}>{step?.title ?? 'Deleted step'}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${meta.bg} ${meta.text}`}>{meta.label}</span>
                    </p>
                    {f.comment && (
                      <p className="text-[13px] leading-relaxed" style={{ color: fgAt(0.6) }}>{f.comment}</p>
                    )}
                    {f.medicalComment && (
                      <div className="space-y-1 rounded-xl bg-brandCP/[0.06] px-3 py-2">
                        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-brandCP">
                          <Stethoscope className="h-3 w-3" />
                          Medical opinion · step {number}
                        </p>
                        <p className="text-[13px] leading-relaxed" style={{ color: fgAt(0.6) }}>{f.medicalComment}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Toutes les walkthroughs du challenge, groupées par application.
 *
 * Sans quorum ni majorité, c'est le seul contrôle qualité de la v1 : il doit
 * donc se lire, pas se déchiffrer. La ligne de marques donne la forme d'une
 * walkthrough en un coup d'oeil ; le dépliage donne les mots.
 */
export function ScenarioWalkthroughsPanel({ challengeId, open }: { challengeId: string; open: boolean }) {
  const [steps, setSteps] = useState<ScenarioStep[]>([]);
  const [runs, setRuns] = useState<WalkthroughRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const wasOpen = useRef(false);
  useEffect(() => {
    const justOpened = open && !wasOpen.current;
    wasOpen.current = open;
    if (!justOpened) return;
    setLoading(true);
    setError('');
    fetch(`/api/challenges/${challengeId}/validation-scenario-runs`)
      .then(async res => {
        if (!res.ok) {
          // Avec zéro quorum ce panneau EST le contrôle qualité : un 403/500
          // qui se lit "No walkthrough yet" est la seule mauvaise réponse
          // possible à donner à un manager qui inspecte le travail des
          // validateurs.
          const d = await res.json().catch(() => ({}));
          setError(d.error || 'Could not load the walkthroughs');
          return;
        }
        const d = await res.json();
        setSteps(d.steps ?? []);
        setRuns(d.runs ?? []);
      })
      .catch(() => setError('Network error'))
      .finally(() => setLoading(false));
  }, [open, challengeId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2 text-xs" style={{ color: fgAt(0.35) }}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
      </div>
    );
  }

  if (error) {
    return (
      <p className="rounded-lg border border-red-500/20 bg-red-500/[0.06] px-3 py-2 text-xs text-red-400">{error}</p>
    );
  }

  if (runs.length === 0) {
    return (
      <p className="rounded-[16px] border border-dashed border-white/[0.06] px-4 py-3 text-xs" style={{ color: fgAt(0.3) }}>
        No walkthrough yet.
      </p>
    );
  }

  const stepsById = new Map(steps.map(s => [s.id, s]));
  const byApplication = new Map<string, WalkthroughRun[]>();
  for (const run of runs) {
    const list = byApplication.get(run.contributionId) ?? [];
    list.push(run);
    byApplication.set(run.contributionId, list);
  }

  return (
    <div className="space-y-4">
      <p className="text-xs" style={{ color: fgAt(0.35) }}>
        No quorum in this iteration — this panel is the quality control.
      </p>

      {[...byApplication.entries()].map(([contributionId, appRuns]) => (
        <div key={contributionId} className="overflow-hidden rounded-[20px] border border-white/[0.06] bg-white/[0.02]">
          <div className="flex flex-wrap items-center gap-2.5 border-b border-white/[0.06] px-4 py-3">
            <span className="text-sm font-semibold" style={{ color: fgAt(0.8) }}>{appRuns[0].submitterName}</span>
            {appRuns[0].endpointUrl && (
              <a
                href={appRuns[0].endpointUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="truncate font-mono text-[11px] text-brandCP/70 hover:text-brandCP"
              >
                {appRuns[0].endpointUrl}
              </a>
            )}
            <span className="ml-auto rounded-full bg-white/8 px-2.5 py-0.5 text-[11px] font-semibold" style={{ color: fgAt(0.45) }}>
              {appRuns.length} {appRuns.length === 1 ? 'walkthrough' : 'walkthroughs'}
            </span>
          </div>
          {appRuns.map(run => (
            <RunRow key={run.id} run={run} steps={stepsById} stepCount={steps.length} />
          ))}
        </div>
      ))}
    </div>
  );
}
