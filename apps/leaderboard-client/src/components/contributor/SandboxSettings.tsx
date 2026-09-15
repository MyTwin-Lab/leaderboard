"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Star, Trash2, Trophy } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { formatCP } from "@/lib/formatters";
import type { SandboxRewardView, SandboxView } from "@/lib/public/sandbox";
import type { SandboxStarTier } from "@packages/database-service/domain/entities";
import {
  validatePromotionBonus,
  validateTiers,
  type TierDraft,
} from "./sandboxTiers";

interface SandboxSettingsProps {
  tiers: SandboxStarTier[];
  promotionBonusCp: number;
}

/** Une ligne de l'audit, telle que la route admin la rend. */
interface AuditStar {
  uuid: string;
  origin: string;
  day: string;
  ip_hash_prefix: string | null;
  is_account: boolean;
  removed_at: string | null;
  attached_at: string | null;
  created_at: string;
}

interface AuditGroup {
  origin: string;
  day: string;
  ip_hash_prefix: string | null;
  count: number;
  active: number;
  attached: number;
  star_uuids: string[];
}

interface AuditResponse {
  sandbox_id: string;
  star_count: number;
  stars: AuditStar[];
  groups: AuditGroup[];
}

const INPUT_CLASS =
  "rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-white transition-colors focus:border-brandCP/40 focus:outline-none";

/**
 * Onglet admin « Sandbox ».
 *
 * Deux outils dans un seul panneau, parce qu'ils se lisent ensemble :
 *
 *  - **l'économie** — les paliers de stars et le bonus de promotion. Inertes
 *    par défaut : tant que rien n'est configuré, un sandbox ne paie rien ;
 *  - **l'audit** — les stars d'une proposition, ligne à ligne et groupées par
 *    origine, IP hachée et jour, avec la suppression. C'est la contrepartie du
 *    fait qu'un palier payé n'est jamais repris automatiquement : une vague
 *    frauduleuse doit pouvoir être défaite à la main.
 *
 * À savoir avant de nettoyer : si le compteur reste au-dessus d'un seuil après
 * coup, le palier sera **re-payé à la prochaine star** — supprimer la reward
 * sans supprimer les stars ne fait que retarder le paiement. Les deux gestes
 * vont ensemble, d'où leur voisinage ici.
 */
export function SandboxSettings({ tiers: initialTiers, promotionBonusCp }: SandboxSettingsProps) {
  // ── Économie ────────────────────────────────────────────────────────────
  const [rows, setRows] = useState<TierDraft[]>(
    initialTiers.map((tier) => ({ stars: String(tier.stars), cp: String(tier.cp) })),
  );
  const [bonus, setBonus] = useState(String(promotionBonusCp));
  const [savingTiers, setSavingTiers] = useState(false);
  const [tiersMessage, setTiersMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Audit ───────────────────────────────────────────────────────────────
  const [sandboxes, setSandboxes] = useState<SandboxView[] | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [audit, setAudit] = useState<AuditResponse | null>(null);
  const [rewards, setRewards] = useState<SandboxRewardView[] | null>(null);
  const [selectedStars, setSelectedStars] = useState<Set<string>>(new Set());
  const [auditBusy, setAuditBusy] = useState(false);

  const patchSettings = async (body: Record<string, unknown>): Promise<boolean> => {
    setError(null);
    try {
      // Les réglages du module sandbox : fusionnés aux actuels, puis validés par son schéma.
      const res = await fetch("/api/modules/sandbox", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: body }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.details ?? payload?.error ?? "Failed to save");
      }
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
      return false;
    }
  };

  const saveTiers = async () => {
    const validation = validateTiers(rows);
    if (!validation.ok) {
      setTiersMessage(null);
      setError(validation.error);
      return;
    }
    setSavingTiers(true);
    setTiersMessage(null);
    const ok = await patchSettings({ star_tiers: validation.tiers });
    setSavingTiers(false);
    if (ok) setTiersMessage("Milestones saved.");
  };

  const commitBonus = async () => {
    const validation = validatePromotionBonus(bonus);
    if (!validation.ok) {
      setBonus(String(promotionBonusCp));
      setError(validation.error);
      return;
    }
    await patchSettings({ promotion_bonus_cp: validation.value });
  };

  // Le listing public sert de sélecteur : un admin y voit tout, archivés
  // compris, et c'est déjà la seule route qui rassemble titre, auteur et
  // statut. Rien à ajouter côté API pour cet écran.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/sandboxes")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed to load sandboxes"))))
      .then((body) => {
        if (!cancelled) setSandboxes(body.sandboxes ?? []);
      })
      .catch(() => {
        if (!cancelled) setSandboxes([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadAudit = useCallback(async (sandboxId: string) => {
    if (!sandboxId) {
      setAudit(null);
      setRewards(null);
      return;
    }
    setError(null);
    setSelectedStars(new Set());
    try {
      const [starsRes, detailRes] = await Promise.all([
        fetch(`/api/admin/sandboxes/${sandboxId}/stars`),
        fetch(`/api/sandboxes/${sandboxId}`),
      ]);
      if (!starsRes.ok) throw new Error("Failed to load the stars of this sandbox");
      setAudit(await starsRes.json());
      // Le ledger n'est servi qu'à l'auteur et aux admins — un admin l'a donc
      // dans la vue publique du détail, sans route dédiée.
      const detail = detailRes.ok ? await detailRes.json() : null;
      setRewards(detail?.sandbox?.rewards ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load the audit");
      setAudit(null);
      setRewards(null);
    }
  }, []);

  const selectSandbox = (sandboxId: string) => {
    setSelectedId(sandboxId);
    void loadAudit(sandboxId);
  };

  const toggleStar = (uuid: string) => {
    setSelectedStars((current) => {
      const next = new Set(current);
      if (next.has(uuid)) next.delete(uuid);
      else next.add(uuid);
      return next;
    });
  };

  const deleteSelectedStars = async (uuids: string[]) => {
    if (uuids.length === 0 || auditBusy) return;
    if (
      !window.confirm(
        `Delete ${uuids.length} star${uuids.length > 1 ? "s" : ""}? This is a real delete, not an unstar. Already-paid milestones are not clawed back.`,
      )
    ) {
      return;
    }
    setAuditBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/sandboxes/${selectedId}/stars`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uuids }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error ?? "Failed to delete the stars");
      }
      await loadAudit(selectedId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete the stars");
    } finally {
      setAuditBusy(false);
    }
  };

  const deleteReward = async (rewardId: string) => {
    if (auditBusy) return;
    if (
      !window.confirm(
        "Delete this ledger row? The contributor's total drops immediately - there is no cached total. If the star count is still above the threshold, the milestone will be paid again on the next star.",
      )
    ) {
      return;
    }
    setAuditBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/sandbox-rewards/${rewardId}`, { method: "DELETE" });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error ?? "Failed to delete the reward");
      }
      await loadAudit(selectedId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete the reward");
    } finally {
      setAuditBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* ── Paliers ──────────────────────────────────────────────────── */}
      <div>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/30">
          Star milestones
        </h2>

        <div className="space-y-2">
          {rows.length === 0 && (
            <p className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-5 text-center text-xs text-white/30">
              No milestone configured. Stars are a signal, and pay nothing.
            </p>
          )}

          {rows.map((row, index) => (
            <div
              key={index}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3"
            >
              <Star className="h-4 w-4 shrink-0 text-yellow-400" />
              <label className="flex items-center gap-2 text-xs text-white/40">
                at
                <input
                  type="number"
                  min={1}
                  value={row.stars}
                  onChange={(e) =>
                    setRows((current) =>
                      current.map((r, i) => (i === index ? { ...r, stars: e.target.value } : r)),
                    )
                  }
                  className={`${INPUT_CLASS} w-20 text-right`}
                />
                stars
              </label>
              <label className="flex items-center gap-2 text-xs text-white/40">
                pay
                <input
                  type="number"
                  min={0}
                  value={row.cp}
                  onChange={(e) =>
                    setRows((current) =>
                      current.map((r, i) => (i === index ? { ...r, cp: e.target.value } : r)),
                    )
                  }
                  className={`${INPUT_CLASS} w-24 text-right`}
                />
                CP
              </label>
              <button
                type="button"
                onClick={() => setRows((current) => current.filter((_, i) => i !== index))}
                aria-label="Remove this milestone"
                className="ml-auto rounded-lg p-1.5 text-white/30 transition-colors hover:bg-red-500/10 hover:text-red-400"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setRows((current) => [...current, { stars: "", cp: "" }])}
          >
            <Plus className="h-3.5 w-3.5" />
            Add milestone
          </Button>
          <Button size="sm" onClick={saveTiers} disabled={savingTiers}>
            {savingTiers ? "Saving…" : "Save milestones"}
          </Button>
          {tiersMessage && <span className="text-xs text-brandCP">{tiersMessage}</span>}
        </div>

        <p className="mt-3 text-xs leading-relaxed text-white/25">
          Thresholds must strictly increase. A milestone is paid once per sandbox and is never
          clawed back - unstarring reverses nothing. Lowering a threshold below a sandbox&apos;s
          current count does not pay it retroactively: it is paid on that sandbox&apos;s next star.
        </p>
      </div>

      {/* ── Bonus de promotion ───────────────────────────────────────── */}
      <div>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/30">
          Promotion bonus
        </h2>
        <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3.5">
          <div className="flex min-w-0 items-center gap-3">
            <Trophy className="h-4 w-4 shrink-0 text-violet-400" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-white">CP paid when a sandbox is promoted</p>
              <p className="mt-0.5 text-xs text-white/35">
                Out of pool, once per sandbox. 0 keeps the promotion free.
              </p>
            </div>
          </div>
          <input
            type="number"
            min={0}
            value={bonus}
            onChange={(e) => setBonus(e.target.value)}
            onBlur={commitBonus}
            className={`${INPUT_CLASS} w-24 shrink-0 text-right`}
          />
        </div>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {/* ── Audit ────────────────────────────────────────────────────── */}
      <div>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/30">
          Star audit
        </h2>

        <select
          value={selectedId}
          onChange={(e) => selectSandbox(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white focus:border-brandCP/40 focus:outline-none"
        >
          <option value="">Pick a sandbox…</option>
          {(sandboxes ?? []).map((sandbox) => (
            <option key={sandbox.uuid} value={sandbox.uuid}>
              {sandbox.title} - {sandbox.author?.full_name ?? "unknown"} ({sandbox.status},{" "}
              {sandbox.star_count}★)
            </option>
          ))}
        </select>

        {sandboxes?.length === 0 && (
          <p className="mt-3 text-xs text-white/25">No sandbox yet.</p>
        )}

        {audit && (
          <div className="mt-4 space-y-5">
            <p className="text-xs text-white/40">
              {audit.star_count} active star{audit.star_count !== 1 ? "s" : ""} ·{" "}
              {audit.stars.length} row{audit.stars.length !== 1 ? "s" : ""} on record
            </p>

            {/* Groupes : la signature d'une vague automatisée, qu'un tableau
                ligne à ligne noierait. */}
            {audit.groups.length > 0 && (
              <div className="space-y-1.5">
                {audit.groups.map((group) => (
                  <div
                    key={`${group.origin}-${group.ip_hash_prefix ?? "-"}-${group.day}`}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-xs"
                  >
                    <span className="font-medium text-white/70">{group.day}</span>
                    <span className="text-white/40">{group.origin}</span>
                    <span className="font-mono text-white/30">
                      {group.ip_hash_prefix ?? "no ip"}
                    </span>
                    <span className="text-white/50">
                      {group.count} row{group.count !== 1 ? "s" : ""} · {group.active} active
                      {group.attached > 0 ? ` · ${group.attached} attached` : ""}
                    </span>
                    <button
                      type="button"
                      onClick={() => deleteSelectedStars(group.star_uuids)}
                      disabled={auditBusy}
                      className="ml-auto rounded-lg px-2 py-1 font-semibold text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-40"
                    >
                      Delete group
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Lignes brutes : c'est par `uuid` que la suppression se fait. */}
            {audit.stars.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-white/10">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white/[0.03] text-white/35">
                    <tr>
                      <th className="w-8 px-3 py-2" />
                      <th className="px-3 py-2 font-medium">Day</th>
                      <th className="px-3 py-2 font-medium">Origin</th>
                      <th className="px-3 py-2 font-medium">IP hash</th>
                      <th className="px-3 py-2 font-medium">State</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {audit.stars.map((star) => (
                      <tr key={star.uuid} className="text-white/60">
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={selectedStars.has(star.uuid)}
                            onChange={() => toggleStar(star.uuid)}
                            aria-label={`Select the star from ${star.day}`}
                          />
                        </td>
                        <td className="px-3 py-2">{star.day}</td>
                        <td className="px-3 py-2">
                          {star.origin}
                          {star.is_account ? "" : " (anon)"}
                        </td>
                        <td className="px-3 py-2 font-mono text-white/35">
                          {star.ip_hash_prefix ?? "-"}
                        </td>
                        <td className="px-3 py-2">
                          {star.removed_at ? (
                            <span className="text-white/30">removed</span>
                          ) : (
                            <span className="text-brandCP">active</span>
                          )}
                          {star.attached_at && (
                            <span className="ml-1.5 text-violet-400">attached</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {selectedStars.size > 0 && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => deleteSelectedStars([...selectedStars])}
                disabled={auditBusy}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete {selectedStars.size} selected star{selectedStars.size > 1 ? "s" : ""}
              </Button>
            )}

            {/* Ledger : supprimer une ligne *est* la reprise des CP, le total
                d'un contributeur étant un SUM en direct sans cache. */}
            <div>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-white/30">
                Ledger
              </h3>
              {rewards && rewards.length > 0 ? (
                <div className="space-y-1.5">
                  {rewards.map((reward) => (
                    <div
                      key={reward.uuid}
                      className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-xs"
                    >
                      {reward.rule_key === "promotion" ? (
                        <Trophy className="h-3.5 w-3.5 text-violet-400" />
                      ) : (
                        <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                      )}
                      <span className="text-white/70">
                        {reward.rule_key === "promotion"
                          ? "Promotion"
                          : `${reward.tier_stars} stars milestone`}
                      </span>
                      <span className="font-semibold text-brandCP">
                        +{formatCP(reward.points)} CP
                      </span>
                      <span className="text-white/30">
                        {reward.created_at ? reward.created_at.slice(0, 10) : "-"}
                      </span>
                      <button
                        type="button"
                        onClick={() => deleteReward(reward.uuid)}
                        disabled={auditBusy}
                        className="ml-auto rounded-lg px-2 py-1 font-semibold text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-40"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-white/25">
                  Nothing paid on this sandbox yet.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
