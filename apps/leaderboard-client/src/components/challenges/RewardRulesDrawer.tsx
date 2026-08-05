'use client';

import { useEffect, useState } from 'react';
import { Info, X, ArrowDown, Trophy, Lock, Loader2, Users } from 'lucide-react';
import type { MlRewardRules } from '../../../../../packages/database-service/domain/mlRewardRules';

interface ChallengeRules {
  type: string;
  contribution_points_reward: number;
  reward_rules?: MlRewardRules | null;
  cp_per_validation?: number | null;
  required_validations?: number | null;
}

interface RewardRulesDrawerProps {
  challengeId: string;
  open: boolean;
  onClose: () => void;
}

const pct = (n: number) => Math.round(n * 100);

export function RewardRulesDrawer({ challengeId, open, onClose }: RewardRulesDrawerProps) {
  const [challenge, setChallenge] = useState<ChallengeRules | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch(`/api/challenges/${challengeId}`)
      .then(r => (r.ok ? r.json() : null))
      .then(setChallenge)
      .catch(() => setChallenge(null))
      .finally(() => setLoading(false));
  }, [open, challengeId]);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      />

      {/* Drawer */}
      <div
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-lg flex-col border-l border-white/[0.07] shadow-2xl transition-transform duration-300 ease-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ background: 'var(--background-dark)', color: 'var(--foreground)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.07] px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.07]">
              <Info className="h-3.5 w-3.5 text-white/50" />
            </div>
            <h2 className="text-sm font-semibold text-white">Reward rules</h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-white/30 transition-colors hover:bg-white/[0.06] hover:text-white/60"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {loading ? (
            <div className="flex items-center gap-2 py-8 justify-center text-xs text-white/35">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
            </div>
          ) : !challenge ? (
            <p className="py-8 text-center text-xs text-white/35">Could not load this challenge&apos;s rules.</p>
          ) : challenge.type === 'ml' ? (
            <MlRules challenge={challenge} />
          ) : challenge.type === 'validation' ? (
            <ValidationRules challenge={challenge} />
          ) : (
            <CodeRules challenge={challenge} />
          )}
        </div>
      </div>
    </>
  );
}

// ─── Flow primitives ────────────────────────────────────────────────────────

function FlowArrow() {
  return (
    <div className="flex justify-center py-1">
      <ArrowDown className="h-4 w-4 text-white/20" />
    </div>
  );
}

function FlowBox({
  icon, title, children, tone = 'default',
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  tone?: 'default' | 'warning';
}) {
  return (
    <div className={`rounded-xl border p-4 space-y-1.5 ${
      tone === 'warning'
        ? 'border-amber-500/25 bg-amber-500/[0.06]'
        : 'border-white/[0.08] bg-white/[0.03]'
    }`}>
      <div className="flex items-center gap-2">
        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
          tone === 'warning' ? 'bg-amber-500/15 text-amber-300' : 'bg-brandCP/10 text-brandCP'
        }`}>
          {icon}
        </div>
        <span className="text-sm font-semibold text-white">{title}</span>
      </div>
      <div className="pl-9 text-xs leading-relaxed text-white/55">{children}</div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-white/30">{children}</p>
  );
}

// ─── ML ─────────────────────────────────────────────────────────────────────

function MlRules({ challenge }: { challenge: ChallengeRules }) {
  const rules = challenge.reward_rules;
  if (!rules) {
    return <p className="text-xs text-white/35">No reward rules configured for this challenge yet.</p>;
  }

  const kaggleShare = pct(rules.model.kaggleShare);
  const codeShare = 100 - kaggleShare;
  const baseline = pct(rules.model.metric.baseline);
  const threshold = rules.model.metric.blockThreshold != null ? pct(rules.model.metric.blockThreshold) : null;
  const datasetShare = pct(rules.reuse.datasetShare);
  const modelShare = pct(rules.reuse.modelShare);
  const minKeep = pct(rules.reuse.minKeepShare);

  return (
    <div className="space-y-6">
      <div>
        <SectionLabel>How points are earned</SectionLabel>
        <div className="space-y-0">
          <FlowBox icon={<span className="text-sm">📊</span>} title="Dataset">
            Scored by the evaluator — up to <b className="text-white/80">{rules.dataset.cap} CP</b>.
            Reusing someone else&apos;s dataset earns nothing here.
          </FlowBox>
          <FlowArrow />
          <FlowBox icon={<span className="text-sm">🧠</span>} title="Model">
            Kaggle metric ({rules.model.metric.name.toUpperCase()}) is worth <b className="text-white/80">{kaggleShare}%</b> of{' '}
            <b className="text-white/80">{rules.model.cap} CP</b>; the GitHub code (evaluator score) is worth the
            remaining <b className="text-white/80">{codeShare}%</b>.
            {baseline > 0 && <> A metric at or below <b className="text-white/80">{baseline}%</b> earns 0.</>}
            {rules.model.beatBestBonus > 0 && (
              <div className="mt-2 flex items-center gap-1.5 text-brandCP/80">
                <Trophy className="h-3 w-3 shrink-0" />
                +{rules.model.beatBestBonus} CP flat for the first submission to beat the challenge&apos;s record.
              </div>
            )}
          </FlowBox>
          {threshold != null && (
            <>
              <FlowArrow />
              <FlowBox icon={<Lock className="h-3.5 w-3.5" />} title="Threshold" tone="warning">
                Once {rules.model.metric.name.toUpperCase()} reaches <b className="text-white/80">{threshold}%</b>,
                Dataset and Model submissions close — only API Packaging stays open.
              </FlowBox>
            </>
          )}
          <FlowArrow />
          <FlowBox icon={<span className="text-sm">📦</span>} title="API Packaging">
            Scored by the evaluator as code — up to <b className="text-white/80">{rules.apiPackaging.cap} CP</b>.
            Always open, even past the threshold above.
          </FlowBox>
        </div>
      </div>

      <div>
        <SectionLabel>Reuse — shared with whoever you build on</SectionLabel>
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs text-white/55">
            <Users className="h-3.5 w-3.5 shrink-0 text-white/30" />
            <span>Your model reward</span>
          </div>
          <div className="space-y-2 pl-1">
            <div className="flex items-center gap-2 text-xs">
              <ArrowDown className="h-3.5 w-3.5 shrink-0 -rotate-90 text-white/20" />
              <span className="text-white/55">
                <b className="text-brandCP">{datasetShare}%</b> to the reused dataset&apos;s author
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <ArrowDown className="h-3.5 w-3.5 shrink-0 -rotate-90 text-white/20" />
              <span className="text-white/55">
                <b className="text-brandCP">{modelShare}%</b> to the reused model&apos;s (GitHub) author
              </span>
            </div>
          </div>
          <p className="border-t border-white/[0.06] pt-2 text-[11px] text-white/35">
            You always keep at least {minKeep}% of your gross reward, however many artifacts you reuse.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Validation ─────────────────────────────────────────────────────────────

function ValidationRules({ challenge }: { challenge: ChallengeRules }) {
  const cpPerValidation = challenge.cp_per_validation ?? 0;
  const required = challenge.required_validations ?? 0;

  return (
    <div>
      <SectionLabel>How points are earned</SectionLabel>
      <div className="space-y-0">
        <FlowBox icon={<span className="text-sm">📬</span>} title="Submission exposed">
          An admin/manager picks an API packaging submission and its endpoint to test.
        </FlowBox>
        <FlowArrow />
        <FlowBox icon={<span className="text-sm">🗳️</span>} title="Validators test & vote">
          Anyone drops a file, sees the live output, and votes Fonctionne or Défectueux.
        </FlowBox>
        <FlowArrow />
        <FlowBox icon={<span className="text-sm">🏁</span>} title="Majority resolves it">
          Once <b className="text-white/80">{required}</b> votes are in, the majority side wins permanently.
        </FlowBox>
        <FlowArrow />
        <FlowBox icon={<span className="text-sm">💰</span>} title="Winners get paid">
          <b className="text-white/80">{cpPerValidation} CP</b> to each validator on the winning side — the minority
          earns nothing, even for the same work.
        </FlowBox>
      </div>
    </div>
  );
}

// ─── Code ───────────────────────────────────────────────────────────────────

function CodeRules({ challenge }: { challenge: ChallengeRules }) {
  return (
    <div>
      <SectionLabel>How points are earned</SectionLabel>
      <div className="space-y-0">
        <FlowBox icon={<span className="text-sm">✅</span>} title="Contributions scored">
          Every contribution is graded by the evaluator (a score out of 9 per criterion).
        </FlowBox>
        <FlowArrow />
        <FlowBox icon={<span className="text-sm">➗</span>} title="Proportional share">
          At close, your score is divided by the total score of every contribution on this challenge.
        </FlowBox>
        <FlowArrow />
        <FlowBox icon={<span className="text-sm">💰</span>} title="Your CP">
          That fraction of the <b className="text-white/80">{challenge.contribution_points_reward} CP</b> pool is yours.
        </FlowBox>
      </div>
    </div>
  );
}
