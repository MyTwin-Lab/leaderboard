'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, ExternalLink, Loader2, Stethoscope } from 'lucide-react';
import { RESULT_META, SCENARIO_RESULTS } from './scenarioResult';
import {
  finishHint,
  finishBlocker,
  firstUnansweredIndex,
  mergeStepsAfterSave,
  type WalkthroughStepView,
} from './scenarioWalkthroughState';

interface Props {
  challengeId: string;
  contributionId: string;
  submitterName: string;
  endpointUrl: string | null;
  onClose: () => void;
}

function fgAt(opacity: number) {
  return `color-mix(in srgb, var(--foreground) ${Math.round(opacity * 100)}%, transparent)`;
}

/**
 * Le parcours lui-même : l'application à gauche dans une iframe, une seule
 * étape à la fois à droite.
 *
 * Une seule étape, parce que sept étapes dépliées à côté d'une application
 * vivante veut dire défiler dans deux directions en même temps. Le validateur
 * fait une chose, le panneau montre cette chose. Ce que la liste complète
 * donnait gratuitement — savoir où on en est, et ce qu'il reste — revient par
 * la barre de progression.
 *
 * Chaque saisie émet son PUT, donc naviguer entre étapes ne perd rien, et
 * fermer l'onglet non plus.
 */
export function ScenarioWalkthroughScreen({
  challengeId, contributionId, submitterName, endpointUrl, onClose,
}: Props) {
  const [steps, setSteps] = useState<WalkthroughStepView[]>([]);
  // Le dernier snapshot qu'on sait confirmé par le serveur — pas un miroir de
  // `steps`, qui peut être en avance dessus le temps d'une saisie. C'est la
  // référence par rapport à laquelle mergeStepsAfterSave détecte qu'une autre
  // étape a encore une saisie locale non confirmée à préserver.
  const [confirmedSteps, setConfirmedSteps] = useState<WalkthroughStepView[]>([]);
  const [runId, setRunId] = useState<string | null>(null);
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  const [globalFeedback, setGlobalFeedback] = useState('');
  const [cpAwarded, setCpAwarded] = useState<number | null>(null);
  const [cpPerValidation, setCpPerValidation] = useState(0);
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [missingStepIds, setMissingStepIds] = useState<string[]>([]);
  // Étapes dont le dernier PUT n'a pas abouti : le texte reste affiché tel
  // quel (on ne revient jamais dessus), mais Finish doit rester bloqué tant
  // que le serveur ne l'a pas confirmé — sinon on paie sur la foi d'un
  // commentaire qui n'a jamais quitté le navigateur.
  const [unsavedStepIds, setUnsavedStepIds] = useState<string[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [runRes, targetsRes] = await Promise.all([
          fetch(`/api/challenges/${challengeId}/validation-scenario-runs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contribution_id: contributionId }),
          }),
          fetch(`/api/challenges/${challengeId}/validation-targets`),
        ]);
        if (cancelled) return;

        if (!runRes.ok) {
          const d = await runRes.json().catch(() => ({}));
          setError(d.error || 'Could not open this walkthrough');
          return;
        }
        const run = await runRes.json();
        if (cancelled) return;
        setRunId(run.runId);
        setSteps(run.steps ?? []);
        setConfirmedSteps(run.steps ?? []);
        setCompletedAt(run.completedAt ?? null);
        setGlobalFeedback(run.globalFeedback ?? '');
        // Reprendre sur la première étape sans résultat, pas sur l'étape 1.
        setCurrent(firstUnansweredIndex(run.steps ?? []));

        // Le taux de CP est un à-côté facultatif : s'il échoue à se lire, la
        // walkthrough a quand même bien ouvert. Son propre try/catch l'empêche
        // de remonter dans le `error` partagé avec l'ouverture elle-même —
        // sinon un JSON invalide ici afficherait "Could not open this
        // walkthrough" alors que l'écran fonctionne très bien.
        try {
          if (targetsRes.ok) {
            const d = await targetsRes.json();
            if (!cancelled) setCpPerValidation(d.pool?.cpPerValidation ?? 0);
          }
        } catch { /* cpPerValidation reste à sa valeur par défaut */ }
      } catch {
        // fetch() rejette (panne réseau, CORS, abort) plutôt que de résoudre
        // ok:false — sans ce filet l'écran resterait bloqué sur le squelette.
        if (!cancelled) setError('Could not open this walkthrough');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [challengeId, contributionId]);

  const isReadOnly = !!completedAt;
  const step = steps[current];
  const blocker = finishBlocker(steps, globalFeedback, unsavedStepIds.length);
  const answeredCount = steps.filter(s => s.result !== null).length;

  // Une reprise déjà terminée n'a pas de cpAwarded — ce champ ne vient que de
  // la réponse de /complete, pas de la lecture initiale. On retombe alors sur
  // le taux nominal du challenge : c'est une approximation, pas le montant
  // exact enregistré pour cette walkthrough — les deux ne diffèrent que si le
  // pool était presque épuisé au moment de la finir.
  const displayedCp = cpAwarded ?? (isReadOnly ? cpPerValidation : null);

  const saveStep = useCallback(async (patch: Partial<WalkthroughStepView>) => {
    if (!runId || !step || isReadOnly) return;
    const next = { ...step, ...patch };
    // Optimiste : la barre de progression et les boutons réagissent tout de
    // suite, le PUT confirme derrière.
    setSteps(prev => prev.map(s => (s.stepId === step.stepId ? next : s)));
    if (next.result === null) return;

    setSaving(true);
    setError('');
    try {
      const res = await fetch(
        `/api/challenges/${challengeId}/validation-scenario-runs/${runId}/steps/${step.stepId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            result: next.result,
            comment: next.comment,
            medical_comment: next.medicalComment,
          }),
        }
      );
      if (res.ok) {
        const state = await res.json();
        const serverSteps: WalkthroughStepView[] = state.steps ?? [];
        // Fusion étape par étape, pas un remplacement du tableau entier : une
        // autre étape peut porter une saisie locale (un commentaire tapé sans
        // résultat, donc jamais PUT) que ce snapshot n'a jamais vue et qui ne
        // doit pas disparaître sous prétexte que CETTE étape vient de réussir.
        setSteps(prev => mergeStepsAfterSave(prev, confirmedSteps, serverSteps, step.stepId));
        setConfirmedSteps(serverSteps);
        setMissingStepIds([]);
        // Confirmé par le serveur : ce n'est plus un texte tapé qui ne lui
        // est jamais parvenu.
        setUnsavedStepIds(prev => prev.filter(id => id !== step.stepId));
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error || 'Could not save this step');
        // La saisie reste affichée telle quelle — on ne l'efface jamais —
        // mais Finish doit rester bloqué tant qu'elle n'a pas atteint le
        // serveur, sinon on paie sur la foi de ce que l'écran montre plutôt
        // que de ce qui est réellement enregistré.
        setUnsavedStepIds(prev => (prev.includes(step.stepId) ? prev : [...prev, step.stepId]));
      }
    } catch {
      setError('Network error');
      setUnsavedStepIds(prev => (prev.includes(step.stepId) ? prev : [...prev, step.stepId]));
    }
    finally { setSaving(false); }
  }, [challengeId, runId, step, isReadOnly, confirmedSteps]);

  const handleFinish = async () => {
    if (!runId || blocker) return;
    setFinishing(true);
    setError('');
    try {
      const res = await fetch(
        `/api/challenges/${challengeId}/validation-scenario-runs/${runId}/complete`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ global_feedback: globalFeedback }),
        }
      );
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setCompletedAt(new Date().toISOString());
        setCpAwarded(d.cpAwarded ?? 0);
      } else {
        setError(d.error || 'Could not finish this walkthrough');
        // Le serveur nomme les étapes manquantes : on allume leurs points au
        // lieu de laisser le validateur chercher lesquelles il a sautées.
        setMissingStepIds(d.missingStepIds ?? []);
      }
    } catch { setError('Network error'); }
    finally { setFinishing(false); }
  };

  const header = (
    <div className="flex flex-wrap items-center gap-3">
      <button
        onClick={onClose}
        className="flex items-center gap-1.5 text-[13px] font-medium transition-colors hover:text-brandCP"
        style={{ color: fgAt(0.45) }}
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Applications
      </button>
      <div className="min-w-0 flex-1 basis-48">
        <span className="block truncate text-[15px] font-semibold" style={{ color: fgAt(0.85) }}>{submitterName}</span>
        {endpointUrl && (
          <span className="block truncate font-mono text-xs" style={{ color: fgAt(0.35) }}>{endpointUrl}</span>
        )}
      </div>
      <span
        className={`rounded-full px-3 py-1 text-[11px] font-bold ${
          isReadOnly ? 'bg-green-500/15 text-green-400' : 'bg-amber-500/15 text-amber-400'
        }`}
      >
        {isReadOnly
          ? `Walkthrough completed${displayedCp !== null ? ` — ${displayedCp} CP` : ''}`
          : 'Draft · saved as you go'}
      </span>
    </div>
  );

  if (loading) {
    return <div className="h-96 animate-pulse rounded-xl border border-white/[0.06] bg-white/5" />;
  }

  if (error && !runId) {
    return (
      <div className="space-y-4">
        {header}
        <p className="rounded-lg border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-sm text-red-400">{error}</p>
      </div>
    );
  }

  // Terminé : plus de "une étape à la fois". Quelqu'un qui se relit veut tout
  // d'un coup, et il n'y a plus d'étape courante à mettre en avant.
  if (isReadOnly) {
    return (
      <div className="space-y-4 animate-fade-up">
        {header}
        <div className="space-y-2">
          {steps.map((s, i) => {
            const meta = s.result ? RESULT_META[s.result] : null;
            return (
              <div key={s.stepId} className="space-y-2 rounded-[18px] border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="font-mono text-[11px]" style={{ color: fgAt(0.3) }}>{String(i + 1).padStart(2, '0')}</span>
                  <span className="text-sm font-medium" style={{ color: fgAt(0.8) }}>{s.title}</span>
                  {meta && (
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${meta.bg} ${meta.text}`}>{meta.label}</span>
                  )}
                </div>
                {s.comment && <p className="text-[13px] leading-relaxed" style={{ color: fgAt(0.55) }}>{s.comment}</p>}
                {s.medicalComment && (
                  <div className="space-y-1 rounded-xl bg-brandCP/[0.06] px-3 py-2">
                    <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-brandCP">
                      <Stethoscope className="h-3 w-3" /> Medical opinion
                    </p>
                    <p className="text-[13px] leading-relaxed" style={{ color: fgAt(0.55) }}>{s.medicalComment}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {globalFeedback && (
          <div className="space-y-1.5 rounded-[18px] border border-white/[0.06] bg-white/[0.02] px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: fgAt(0.35) }}>Overall feedback</p>
            <p className="text-[13px] leading-relaxed" style={{ color: fgAt(0.6) }}>{globalFeedback}</p>
          </div>
        )}
      </div>
    );
  }

  const isLast = current === steps.length - 1;
  const stepUnsaved = !!step && unsavedStepIds.includes(step.stepId);

  return (
    <div className="space-y-4 animate-fade-up">
      {header}

      {/* auto-fit plutôt qu'un breakpoint : la colonne passe dessous d'elle-même sous ~700px. */}
      <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(320px,1fr))]">
        <div className="space-y-2.5">
          {endpointUrl ? (
            // `allow` délègue la caméra à l'application encadrée. Sans cet
            // attribut, une iframe multi-origine n'y a aucun droit : la
            // politique de permissions par défaut vaut `self`, et
            // getUserMedia y est refusé sans même afficher de demande. Une
            // application dont le coeur est la caméra serait alors bloquée par
            // NOTRE cadre, pas par son propre code — un résultat de validation
            // faux. La délégation ne vaut que pour l'origine chargée ici, et
            // le navigateur demande quand même son accord au validateur. Pas
            // de micro : rien dans le scénario ne le justifie.
            <iframe
              src={endpointUrl}
              title={`${submitterName} — application under validation`}
              allow="camera"
              className="h-[min(620px,70vh)] w-full rounded-[20px] border border-white/10 bg-white"
            />
          ) : (
            <div className="flex h-[min(620px,70vh)] items-center justify-center rounded-[20px] border border-dashed border-white/10 px-6 text-center">
              <p className="text-xs" style={{ color: fgAt(0.3) }}>No endpoint recorded for this application.</p>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            {endpointUrl && (
              <a
                href={endpointUrl}
                target="_blank"
                rel="ugc noreferrer noopener"
                className="flex items-center gap-1.5 rounded-full border border-white/10 px-3.5 py-2 text-xs font-semibold transition-colors hover:border-white/20"
                style={{ color: fgAt(0.7) }}
              >
                <ExternalLink className="h-3.5 w-3.5 text-brandCP" /> Open in a tab
              </a>
            )}
            <span className="text-xs" style={{ color: fgAt(0.3) }}>
              The platform never calls this application — your browser does.
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: fgAt(0.35) }}>
              Step {current + 1} of {steps.length}
            </span>
            <span className="flex items-center gap-2 text-xs font-semibold" style={{ color: fgAt(0.5) }}>
              {saving && <Loader2 className="h-3 w-3 animate-spin" />}
              {answeredCount} / {steps.length} answered
            </span>
          </div>

          {/* La barre : où on en est, et ce qu'il reste — sans mettre un seul
              contenu d'étape à l'écran. Un clic saute à l'étape. Un contour
              ambre signale une étape dont le dernier enregistrement a échoué,
              en plus (pas à la place) de sa couleur de résultat. */}
          <div className="flex gap-1.5">
            {steps.map((s, i) => {
              const meta = s.result ? RESULT_META[s.result] : null;
              const isMissing = missingStepIds.includes(s.stepId);
              const isUnsaved = unsavedStepIds.includes(s.stepId);
              return (
                <button
                  key={s.stepId}
                  onClick={() => setCurrent(i)}
                  aria-label={`Go to step ${i + 1}: ${s.title}${isUnsaved ? ' — could not be saved' : ''}`}
                  title={isUnsaved ? 'Could not be saved — open this step to retry' : undefined}
                  className={`h-1.5 flex-1 rounded-full transition-all ${
                    meta ? meta.strong : isMissing ? 'bg-red-500/50' : 'bg-white/10'
                  } ${i === current ? 'ring-2 ring-brandCP/40' : ''} ${
                    isUnsaved ? 'outline outline-2 outline-amber-400/70 outline-offset-1' : ''
                  }`}
                />
              );
            })}
          </div>

          {step && (
            <div
              className={`space-y-3 rounded-[18px] border bg-white/[0.02] px-4 py-4 ${
                step.result ? RESULT_META[step.result].border : 'border-white/[0.06]'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 shrink-0 font-mono text-[11px]" style={{ color: fgAt(0.3) }}>
                  {String(current + 1).padStart(2, '0')}
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-[15px] font-semibold leading-snug" style={{ color: fgAt(0.85) }}>{step.title}</p>
                  {step.instructions && (
                    <p className="text-xs leading-relaxed" style={{ color: fgAt(0.45) }}>{step.instructions}</p>
                  )}
                </div>
              </div>

              {stepUnsaved && (
                <p className="rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2 text-xs text-amber-400">
                  This step could not be saved — mark a result or edit the comment again to retry. Your text has not been lost.
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                {SCENARIO_RESULTS.map(r => {
                  const meta = RESULT_META[r];
                  const on = step.result === r;
                  return (
                    <button
                      key={r}
                      // Un clic sur le résultat déjà choisi ne fait rien : il
                      // n'y a pas de route DELETE, donc désélectionner en
                      // local créerait un état que le serveur ne peut pas
                      // représenter — la ligne resterait, la vue ne la
                      // montrerait plus, jusqu'à ce que le prochain
                      // enregistrement d'une autre étape la fasse réapparaître.
                      onClick={() => { if (!on) saveStep({ result: r }); }}
                      className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all ${
                        on ? `${meta.bg} ${meta.border} ${meta.text}` : 'border-white/10 hover:border-white/20'
                      }`}
                      style={on ? undefined : { color: fgAt(0.5) }}
                    >
                      {meta.label}
                    </button>
                  );
                })}
              </div>

              <textarea
                rows={2}
                value={step.comment ?? ''}
                onChange={e => setSteps(prev => prev.map(s => (s.stepId === step.stepId ? { ...s, comment: e.target.value } : s)))}
                onBlur={() => saveStep({})}
                placeholder="What happened? (optional)"
                className="w-full resize-y rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[13px] leading-relaxed placeholder:text-white/20 focus:border-brandCP/40 focus:outline-none"
                style={{ color: fgAt(0.85) }}
              />

              {/* Les deux lentilles coexistent sur la même étape : pas un
                  onglet, pas un mode. Le champ n'apparaît que pour un
                  medical_pro, et le serveur le refuse aux autres de toute façon. */}
              <MedicalCommentField
                value={step.medicalComment ?? ''}
                onChange={v => setSteps(prev => prev.map(s => (s.stepId === step.stepId ? { ...s, medicalComment: v } : s)))}
                onBlur={() => saveStep({})}
              />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setCurrent(c => Math.max(0, c - 1))}
              disabled={current === 0}
              className="flex items-center gap-1.5 rounded-full border border-white/10 px-4 py-2.5 text-[13px] font-semibold transition-all hover:border-white/20 disabled:opacity-30"
              style={{ color: fgAt(0.6) }}
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Previous
            </button>
            {!isLast && (
              <>
                <button
                  onClick={() => setCurrent(c => Math.min(steps.length - 1, c + 1))}
                  disabled={!step?.result}
                  className="flex items-center gap-2 rounded-full bg-brandCP/10 px-5 py-2.5 text-[13px] font-semibold text-brandCP transition-all hover:bg-brandCP/15 disabled:cursor-not-allowed disabled:bg-white/[0.04] disabled:text-white/25"
                >
                  Next step <ArrowRight className="h-3.5 w-3.5" />
                </button>
                {!step?.result && (
                  <span className="text-xs text-amber-400/80">Mark this step passed, failed or blocked to continue</span>
                )}
              </>
            )}
          </div>

          {isLast && (
            <div className="space-y-3 rounded-[18px] border border-white/[0.06] bg-white/[0.02] px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[13px] font-semibold" style={{ color: fgAt(0.8) }}>Overall feedback</span>
                <span className="text-[11px] font-semibold text-red-400">Required</span>
              </div>
              <textarea
                rows={4}
                value={globalFeedback}
                onChange={e => setGlobalFeedback(e.target.value)}
                placeholder="Would you trust this application in a consultation? What worked, what did not."
                className="w-full resize-y rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[13px] leading-relaxed placeholder:text-white/20 focus:border-brandCP/40 focus:outline-none"
                style={{ color: fgAt(0.85) }}
              />
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={handleFinish}
                  disabled={!!blocker || finishing}
                  className="flex items-center gap-2 rounded-full bg-brandCP/10 px-5 py-2.5 text-[13px] font-semibold text-brandCP transition-all hover:bg-brandCP/15 disabled:cursor-not-allowed disabled:bg-white/[0.04] disabled:text-white/25"
                >
                  {finishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  Finish walkthrough
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold">+{cpPerValidation} CP</span>
                </button>
                <span className={`text-xs ${blocker ? 'text-amber-400/80' : ''}`} style={blocker ? undefined : { color: fgAt(0.35) }}>
                  {finishHint(steps, globalFeedback, cpPerValidation, unsavedStepIds.length)}
                </span>
              </div>
            </div>
          )}

          {error && (
            <p className="rounded-lg border border-red-500/20 bg-red-500/[0.06] px-3 py-2 text-xs text-red-400">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}

/** Réservé au rôle medical_pro — la même frontière de qualification que le flux ML trace déjà. */
function MedicalCommentField({
  value, onChange, onBlur,
}: { value: string; onChange: (v: string) => void; onBlur: () => void }) {
  const [isMedicalPro, setIsMedicalPro] = useState(false);

  useEffect(() => {
    fetch('/api/contributors/me')
      .then(r => (r.ok ? r.json() : null))
      .then(d => setIsMedicalPro(d?.user?.role === 'medical_pro'))
      .catch(() => {});
  }, []);

  if (!isMedicalPro) return null;

  return (
    <div className="space-y-1.5 rounded-xl border border-dashed border-brandCP/35 bg-brandCP/[0.05] px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-brandCP">
        <Stethoscope className="h-3 w-3" /> Medical opinion
      </p>
      <textarea
        rows={2}
        value={value}
        onChange={e => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder="Clinical reading of this step (optional)"
        className="w-full resize-y rounded-lg border border-brandCP/25 bg-white/[0.03] px-2.5 py-2 text-[13px] leading-relaxed placeholder:text-white/20 focus:border-brandCP/50 focus:outline-none"
        style={{ color: fgAt(0.85) }}
      />
    </div>
  );
}
