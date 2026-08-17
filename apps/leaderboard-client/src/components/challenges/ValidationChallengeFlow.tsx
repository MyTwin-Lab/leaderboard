'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Loader2, AlertCircle, Coins, ShieldCheck, FileSearch } from 'lucide-react';
import { ValidationOutputViewer } from './ValidationOutputViewer';

interface OpenClaim {
  id: string;
  observed: boolean;
  revealed: boolean;
}

interface TargetItem {
  id: string;
  contributionId: string;
  submitterUserId: string | null;
  submitterName: string;
  submitterAvatarUrl: string | null;
  alreadyValidatedByMe: boolean;
  verdictCount: number;
  outcome: 'pending' | 'works' | 'broken';
  resolvedAt: string | null;
  myOpenClaims: OpenClaim[];
}

interface PoolState {
  pool: number;
  distributed: number;
  remaining: number;
  cpPerValidation: number;
  requiredValidations: number;
}

/**
 * Since challenge-014, only `medical_pro` users may vote on a validation
 * challenge — testing happens exclusively by claiming a pre-authored
 * ground-truth reference case (see ReferenceCaseAuthorPanel for the writing
 * side), not by dropping an arbitrary file. See
 * challenges/challenge-014-qualified_validation/SPEC.md section 4.3.
 */
export function ValidationChallengeFlow({ challengeId }: { challengeId: string }) {
  const [targets, setTargets] = useState<TargetItem[]>([]);
  const [pool, setPool] = useState<PoolState | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeContributionId, setActiveContributionId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [meRes, targetsRes] = await Promise.all([
        fetch('/api/contributors/me'),
        fetch(`/api/challenges/${challengeId}/validation-targets`),
      ]);
      if (meRes.ok) {
        const me = await meRes.json();
        setRole(me.user?.role ?? null);
      }
      if (targetsRes.ok) {
        const data = await targetsRes.json();
        setTargets(data.targets ?? []);
        setPool(data.pool ?? null);
        setCurrentUserId(data.currentUserId ?? null);
      }
    } finally {
      setLoading(false);
    }
  }, [challengeId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return <div className="h-48 animate-pulse rounded-xl border border-white/[0.06] bg-white/5" />;
  }

  if (role !== 'medical_pro') {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] py-12 text-center">
        <ShieldCheck className="h-7 w-7 text-white/15" />
        <p className="max-w-sm text-xs text-white/25">
          Seuls les professionnels de santé qualifiés (medical_pro) peuvent voter sur ce challenge de validation.
        </p>
      </div>
    );
  }

  if (targets.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] py-12 text-center">
        <ShieldCheck className="h-7 w-7 text-white/15" />
        <p className="text-xs text-white/25">No submission exposed for validation yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-up">
      {pool && pool.pool > 0 && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 space-y-2">
          <div className="flex items-baseline justify-between gap-3">
            <div className="flex items-baseline gap-1.5">
              <Coins className="h-3.5 w-3.5 shrink-0 translate-y-0.5 text-brandCP/60" />
              <span className="text-sm font-semibold text-brandCP">{pool.remaining.toLocaleString()} CP</span>
              <span className="text-xs text-white/35">
                left — {pool.cpPerValidation} CP to each validator on the winning side, once {pool.requiredValidations} verdicts are in
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {targets.map(t => (
          <TargetCard
            key={t.id}
            target={t}
            requiredValidations={pool?.requiredValidations ?? 0}
            challengeId={challengeId}
            isOwnTarget={!!currentUserId && t.submitterUserId === currentUserId}
            expanded={activeContributionId === t.contributionId}
            onToggle={() => setActiveContributionId(activeContributionId === t.contributionId ? null : t.contributionId)}
            onResolved={fetchData}
          />
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ target, requiredValidations }: { target: TargetItem; requiredValidations: number }) {
  if (target.outcome === 'works') {
    return (
      <span className="flex items-center gap-1 rounded-full bg-green-500/15 px-2.5 py-0.5 text-xs font-medium text-green-400">
        <CheckCircle2 className="h-3 w-3" /> Fonctionne ({target.verdictCount}/{requiredValidations})
      </span>
    );
  }
  if (target.outcome === 'broken') {
    return (
      <span className="flex items-center gap-1 rounded-full bg-red-500/15 px-2.5 py-0.5 text-xs font-medium text-red-400">
        <XCircle className="h-3 w-3" /> Défectueux ({target.verdictCount}/{requiredValidations})
      </span>
    );
  }
  return (
    <span className="rounded-full bg-white/8 px-2.5 py-0.5 text-xs font-medium text-white/40">
      {target.verdictCount}/{requiredValidations} validations reçues
    </span>
  );
}

interface ClaimableCase {
  id: string;
  inputFilename: string;
  inputContentType: string;
}

type CardState = 'picking' | 'testing' | 'observing' | 'revealing' | 'revealed';

function TargetCard({
  target,
  requiredValidations,
  challengeId,
  isOwnTarget,
  expanded,
  onToggle,
  onResolved,
}: {
  target: TargetItem;
  requiredValidations: number;
  challengeId: string;
  isOwnTarget: boolean;
  expanded: boolean;
  onToggle: () => void;
  onResolved: () => void;
}) {
  const [state, setState] = useState<CardState>('picking');
  const [loadingCases, setLoadingCases] = useState(false);
  const [claimableCases, setClaimableCases] = useState<ClaimableCase[]>([]);
  const [claimId, setClaimId] = useState<string | null>(null);
  const [liveOutput, setLiveOutput] = useState<{ blob: Blob; contentType: string; status: number } | null>(null);
  const [expectedOutput, setExpectedOutput] = useState<{ blob: Blob; contentType: string } | null>(null);
  const [observation, setObservation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [verdict, setVerdict] = useState<'works' | 'broken' | null>(null);
  const [description, setDescription] = useState('');
  const [verdictResult, setVerdictResult] = useState<{ resolved: boolean; outcome: string; cpAwarded: number } | null>(null);

  const loadClaimableCases = useCallback(async () => {
    setLoadingCases(true);
    setError('');
    try {
      const res = await fetch(`/api/challenges/${challengeId}/validation-targets/${target.id}/claimable-cases`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || 'Failed to load reference cases');
        return;
      }
      const data = await res.json();
      setClaimableCases(data.claimableCases ?? []);
      const openClaim = (data.myOpenClaims ?? [])[0];
      if (openClaim) {
        setClaimId(openClaim.id);
        // Resuming — the live response itself isn't re-fetchable here, so we
        // jump straight to whichever step is still missing rather than
        // re-showing a response we no longer hold client-side.
        setState(openClaim.observed ? 'revealed' : 'observing');
      } else {
        setState('picking');
      }
    } finally {
      setLoadingCases(false);
    }
  }, [challengeId, target.id]);

  useEffect(() => {
    if (!isOwnTarget && expanded) loadClaimableCases();
  }, [expanded, isOwnTarget, loadClaimableCases]);

  const claimCase = async (referenceCaseId: string) => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/challenges/${challengeId}/validation-targets/${target.id}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference_case_id: referenceCaseId }),
      });
      if (res.status === 409) {
        setError('Ce cas vient d’être réclamé par quelqu’un d’autre — choisissez-en un autre.');
        await loadClaimableCases();
        return;
      }
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || 'Failed to claim reference case');
        return;
      }
      const blob = await res.blob();
      const status = Number(res.headers.get('x-validation-status')) || res.status;
      const newClaimId = res.headers.get('x-claim-id');
      setLiveOutput({ blob, contentType: res.headers.get('content-type') ?? 'text/plain', status });
      setClaimId(newClaimId);
      setState('observing');
    } catch {
      setError('Network error');
    } finally {
      setBusy(false);
    }
  };

  const submitObservation = async () => {
    if (!claimId || !observation.trim()) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/challenges/${challengeId}/validation-case-claims/${claimId}/observation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ observation: observation.trim() }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || 'Failed to record observation');
        return;
      }
      // The reveal fires immediately once the observation is locked in — the
      // ordering (observation before reveal) is already guaranteed server-side,
      // no extra click needed here.
      setState('revealing');
      const revealRes = await fetch(`/api/challenges/${challengeId}/validation-case-claims/${claimId}/reveal`, {
        method: 'POST',
      });
      if (!revealRes.ok) {
        const d = await revealRes.json().catch(() => ({}));
        setError(d.error || 'Failed to reveal expected output');
        setState('observing');
        return;
      }
      const blob = await revealRes.blob();
      setExpectedOutput({ blob, contentType: revealRes.headers.get('content-type') ?? 'text/plain' });
      setState('revealed');
    } catch {
      setError('Network error');
    } finally {
      setBusy(false);
    }
  };

  const submitVerdict = async () => {
    if (!verdict || !claimId || !description.trim()) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/challenges/${challengeId}/validation-verdicts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contribution_id: target.contributionId,
          verdict,
          description: description.trim(),
          reference_case_claim_id: claimId,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(d.error || 'Failed to submit verdict');
        return;
      }
      setVerdictResult(d);
      onResolved();
    } catch {
      setError('Network error');
    } finally {
      setBusy(false);
    }
  };

  const canVote = !target.alreadyValidatedByMe && !verdictResult;

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      <button
        onClick={isOwnTarget ? undefined : onToggle}
        disabled={isOwnTarget}
        className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors ${isOwnTarget ? 'cursor-default opacity-50' : 'hover:bg-white/[0.02]'}`}
      >
        <span className="text-sm font-medium text-white/80">{target.submitterName}</span>
        <div className="flex items-center gap-2">
          {isOwnTarget && (
            <span className="text-xs text-white/30">Votre soumission</span>
          )}
          {!isOwnTarget && target.alreadyValidatedByMe && (
            <span className="text-xs text-white/30">Vous avez déjà voté</span>
          )}
          <StatusBadge target={target} requiredValidations={requiredValidations} />
        </div>
      </button>

      {!isOwnTarget && expanded && canVote && (
        <div className="space-y-3 border-t border-white/[0.06] p-4 animate-fade-up">
          {error && (
            <div className="flex items-center gap-1.5 text-xs text-red-400">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {error}
            </div>
          )}

          {state === 'picking' && (
            <div className="space-y-1.5">
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/30">
                <FileSearch className="h-3.5 w-3.5" /> Cas de référence à réclamer
              </p>
              {loadingCases ? (
                <div className="flex items-center gap-2 py-2 text-xs text-white/35">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Chargement…
                </div>
              ) : claimableCases.length === 0 ? (
                <p className="rounded-xl border border-dashed border-white/[0.06] px-4 py-3 text-xs text-white/30">
                  Aucun cas de référence disponible pour l’instant.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {claimableCases.map(c => (
                    <button
                      key={c.id}
                      onClick={() => claimCase(c.id)}
                      disabled={busy}
                      className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-xs text-white/60 transition-colors hover:border-brandCP/40 disabled:opacity-40"
                    >
                      <span className="truncate">{c.inputFilename}</span>
                      <span className="shrink-0 text-brandCP/70">Réclamer &amp; tester</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {(state === 'observing' || state === 'revealing' || state === 'revealed') && liveOutput && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">Réponse réelle</p>
              <ValidationOutputViewer blob={liveOutput.blob} contentType={liveOutput.contentType} />
            </div>
          )}

          {state === 'observing' && (
            <div className="space-y-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              <textarea
                value={observation}
                onChange={e => setObservation(e.target.value)}
                placeholder="Votre observation sur cette réponse (requis avant de voir la sortie attendue)"
                className="w-full rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-xs text-white/70"
                rows={2}
              />
              <button
                onClick={submitObservation}
                disabled={busy || !observation.trim()}
                className="w-full rounded-lg bg-brandCP/20 px-3 py-2 text-xs font-medium text-brandCP transition-colors hover:bg-brandCP/30 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ? 'Envoi…' : 'Enregistrer l’observation'}
              </button>
            </div>
          )}

          {state === 'revealing' && (
            <div className="flex items-center gap-2 py-2 text-xs text-white/35">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Révélation de la sortie attendue…
            </div>
          )}

          {state === 'revealed' && expectedOutput && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">Sortie attendue</p>
              <ValidationOutputViewer blob={expectedOutput.blob} contentType={expectedOutput.contentType} />
            </div>
          )}

          {state === 'revealed' && !verdictResult && (
            <div className="space-y-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              <div className="flex gap-2">
                <button
                  onClick={() => setVerdict('works')}
                  className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                    verdict === 'works' ? 'border-green-500/40 bg-green-500/15 text-green-400' : 'border-white/10 text-white/50 hover:border-white/20'
                  }`}
                >
                  ✅ Fonctionne
                </button>
                <button
                  onClick={() => setVerdict('broken')}
                  className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                    verdict === 'broken' ? 'border-red-500/40 bg-red-500/15 text-red-400' : 'border-white/10 text-white/50 hover:border-white/20'
                  }`}
                >
                  ❌ Défectueux
                </button>
              </div>
              {verdict && (
                <>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Justification (requise)"
                    className="w-full rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-xs text-white/70"
                    rows={2}
                  />
                  <button
                    onClick={submitVerdict}
                    disabled={busy || !description.trim()}
                    className="w-full rounded-lg bg-brandCP/20 px-3 py-2 text-xs font-medium text-brandCP transition-colors hover:bg-brandCP/30 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {busy ? 'Envoi…' : 'Envoyer le verdict'}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {!isOwnTarget && expanded && verdictResult && (
        <div className="space-y-1 border-t border-white/[0.06] p-4 text-xs">
          {verdictResult.cpAwarded > 0 && (
            <p className="font-semibold text-brandCP">+{verdictResult.cpAwarded} CP earned</p>
          )}
          <p className="text-white/40">
            {verdictResult.resolved
              ? `Résolu : ${verdictResult.outcome === 'works' ? 'Fonctionne' : 'Défectueux'}`
              : 'Verdict enregistré — en attente des autres validateurs'}
          </p>
        </div>
      )}
    </div>
  );
}
