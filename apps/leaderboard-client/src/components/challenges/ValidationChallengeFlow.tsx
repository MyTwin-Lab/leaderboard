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
          Only qualified health professionals (medical_pro) can vote on this validation challenge.
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
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-brandCP/[0.22] bg-white/[0.02] px-5 py-4">
          <div className="space-y-0.5">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-semibold tracking-tight text-white">{pool.remaining.toLocaleString()}</span>
              <span className="text-xs font-bold text-brandCP">CP left</span>
            </div>
            <span className="text-xs text-white/35">
              {pool.cpPerValidation} CP to each validator on the winning side, once {pool.requiredValidations} verdicts are in.
            </span>
          </div>
          <span className="flex items-center gap-2 rounded-full bg-brandCP/10 px-3.5 py-2 text-xs font-semibold text-brandCP">
            <Coins className="h-3.5 w-3.5" />
            medical_pro required to vote
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:items-start">
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
        <CheckCircle2 className="h-3 w-3" /> Works ({target.verdictCount}/{requiredValidations})
      </span>
    );
  }
  if (target.outcome === 'broken') {
    return (
      <span className="flex items-center gap-1 rounded-full bg-red-500/15 px-2.5 py-0.5 text-xs font-medium text-red-400">
        <XCircle className="h-3 w-3" /> Broken ({target.verdictCount}/{requiredValidations})
      </span>
    );
  }
  return (
    <span className="rounded-full bg-white/8 px-2.5 py-0.5 text-xs font-medium text-white/40">
      {target.verdictCount}/{requiredValidations} verdicts received
    </span>
  );
}

/** One marker + connecting line in the claim → observe → reveal vertical timeline. */
function StepRow({ index, done, active, last, title, children }: {
  index: number; done: boolean; active: boolean; last?: boolean; title: string; children?: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex shrink-0 flex-col items-center gap-1">
        <span className={`flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
          done ? 'bg-green-500/15 text-green-400' : active ? 'bg-brandCP/15 text-brandCP' : 'bg-white/[0.05] text-white/40'
        }`}>
          {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : index + 1}
        </span>
        {!last && <div className="w-[2px] flex-1 min-h-[18px] rounded-full bg-white/[0.08]" />}
      </div>
      <div className="min-w-0 flex-1 space-y-2 pb-4">
        <span className={`text-xs font-semibold ${done ? 'text-green-400' : active ? 'text-white' : 'text-white/60'}`}>{title}</span>
        {children}
      </div>
    </div>
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
  const [claimedFilename, setClaimedFilename] = useState<string | null>(null);
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
    setClaimedFilename(claimableCases.find(c => c.id === referenceCaseId)?.inputFilename ?? null);
    try {
      const res = await fetch(`/api/challenges/${challengeId}/validation-targets/${target.id}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference_case_id: referenceCaseId }),
      });
      if (res.status === 409) {
        setError('This case was just claimed by someone else — pick another one.');
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
    <div className="rounded-[20px] border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      <button
        onClick={isOwnTarget ? undefined : onToggle}
        disabled={isOwnTarget}
        className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors ${isOwnTarget ? 'cursor-default opacity-50' : 'hover:bg-white/[0.02]'}`}
      >
        <span className="text-sm font-medium text-white/80">{target.submitterName}</span>
        <div className="flex items-center gap-2">
          {isOwnTarget && (
            <span className="text-xs text-white/30">Your submission</span>
          )}
          {!isOwnTarget && target.alreadyValidatedByMe && (
            <span className="text-xs text-white/30">You already voted</span>
          )}
          <StatusBadge target={target} requiredValidations={requiredValidations} />
        </div>
      </button>

      {!isOwnTarget && expanded && canVote && (() => {
        // Which steps are already behind us — drives the check/number marker
        // and the connecting line in the vertical timeline below.
        const doneUpTo = state === 'picking' ? -1 : (state === 'observing' || state === 'revealing') ? 1 : 2;
        return (
        <div className="space-y-0.5 border-t border-white/[0.06] p-4 animate-fade-up">
          {error && (
            <div className="mb-2 flex items-center gap-1.5 text-xs text-red-400">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {error}
            </div>
          )}

          {/* Step 1 — reference case */}
          <StepRow
            index={0}
            done={doneUpTo >= 0}
            active={state === 'picking'}
            title={doneUpTo >= 0
              ? `Reference case claimed${claimedFilename ? ` · ${claimedFilename}` : ''}`
              : 'Reference case to claim'}
          >
            {state === 'picking' && (
              loadingCases ? (
                <div className="flex items-center gap-2 py-1 text-xs text-white/35">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
                </div>
              ) : claimableCases.length === 0 ? (
                <p className="rounded-[12px] border border-dashed border-white/[0.06] px-3 py-2.5 text-xs text-white/30">
                  No reference case available right now.
                </p>
              ) : (
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/25">
                  <FileSearch className="h-3.5 w-3.5" /> Reference case to claim
                </div>
              )
            )}
            {state === 'picking' && !loadingCases && claimableCases.length > 0 && (
              <div className="space-y-1.5">
                {claimableCases.map(c => (
                  <button
                    key={c.id}
                    onClick={() => claimCase(c.id)}
                    disabled={busy}
                    className="flex w-full items-center justify-between rounded-[12px] border border-white/10 bg-white/[0.02] px-3 py-2 text-xs text-white/60 transition-colors hover:border-brandCP/40 disabled:opacity-40"
                  >
                    <span className="truncate">{c.inputFilename}</span>
                    <span className="shrink-0 text-brandCP/70">Claim &amp; test</span>
                  </button>
                ))}
              </div>
            )}
          </StepRow>

          {/* Step 2 — actual response */}
          {liveOutput && (
            <StepRow index={1} done={doneUpTo >= 1} active={false} title="Actual response">
              <ValidationOutputViewer blob={liveOutput.blob} contentType={liveOutput.contentType} />
            </StepRow>
          )}

          {/* Step 3 — observation, required before the reveal */}
          {liveOutput && (
            <StepRow index={2} done={doneUpTo >= 2} active={state === 'observing'} title="Your observation">
              {state === 'observing' && (
                <div className="space-y-2 rounded-[14px] border border-white/[0.06] bg-white/[0.02] p-3">
                  <textarea
                    value={observation}
                    onChange={e => setObservation(e.target.value)}
                    placeholder="Your observation on this response (required before seeing the expected output)"
                    className="w-full rounded-[10px] border border-white/10 bg-white/[0.02] px-3 py-2 text-xs text-white/70"
                    rows={2}
                  />
                  <button
                    onClick={submitObservation}
                    disabled={busy || !observation.trim()}
                    className="w-full rounded-full bg-brandCP/20 px-3 py-2 text-xs font-semibold text-brandCP transition-colors hover:bg-brandCP/30 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {busy ? 'Sending…' : 'Save observation'}
                  </button>
                </div>
              )}
              {state === 'revealing' && (
                <div className="flex items-center gap-2 py-1 text-xs text-white/35">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Revealing expected output…
                </div>
              )}
              {doneUpTo >= 2 && observation && (
                <p className="rounded-[12px] border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs text-white/50">{observation}</p>
              )}
            </StepRow>
          )}

          {/* Step 4 — expected output revealed → verdict */}
          {state === 'revealed' && expectedOutput && (
            <StepRow index={3} done={false} active={!verdictResult} last title="Expected output revealed → verdict">
              <ValidationOutputViewer blob={expectedOutput.blob} contentType={expectedOutput.contentType} />
              {!verdictResult && (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setVerdict('works')}
                      className={`flex-1 rounded-full border px-3 py-2 text-xs font-semibold transition-colors ${
                        verdict === 'works' ? 'border-green-500/40 bg-green-500/15 text-green-400' : 'border-white/10 text-white/50 hover:border-white/20'
                      }`}
                    >
                      ✅ Works
                    </button>
                    <button
                      onClick={() => setVerdict('broken')}
                      className={`flex-1 rounded-full border px-3 py-2 text-xs font-semibold transition-colors ${
                        verdict === 'broken' ? 'border-red-500/40 bg-red-500/15 text-red-400' : 'border-white/10 text-white/50 hover:border-white/20'
                      }`}
                    >
                      ❌ Broken
                    </button>
                  </div>
                  {verdict && (
                    <>
                      <textarea
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        placeholder="Justification (required)"
                        className="w-full rounded-[10px] border border-white/10 bg-white/[0.02] px-3 py-2 text-xs text-white/70"
                        rows={2}
                      />
                      <button
                        onClick={submitVerdict}
                        disabled={busy || !description.trim()}
                        className="w-full rounded-full bg-brandCP/20 px-3 py-2 text-xs font-semibold text-brandCP transition-colors hover:bg-brandCP/30 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {busy ? 'Sending…' : 'Submit verdict'}
                      </button>
                    </>
                  )}
                </div>
              )}
            </StepRow>
          )}
        </div>
        );
      })()}

      {!isOwnTarget && expanded && verdictResult && (
        <div className="space-y-1 border-t border-white/[0.06] p-4 text-xs">
          {verdictResult.cpAwarded > 0 && (
            <p className="font-semibold text-brandCP">+{verdictResult.cpAwarded} CP earned</p>
          )}
          <p className="text-white/40">
            {verdictResult.resolved
              ? `Resolved: ${verdictResult.outcome === 'works' ? 'Works' : 'Broken'}`
              : 'Verdict recorded — waiting on other validators'}
          </p>
        </div>
      )}
    </div>
  );
}
