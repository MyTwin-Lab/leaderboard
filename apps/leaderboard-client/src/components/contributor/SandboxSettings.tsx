"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Star, Trash2, Trophy } from "lucide-react";
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

/** La gélule de saisie de la maquette, alignée à droite pour des nombres. */
const INPUT_CLASS = "v-pro-input";

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
      const res = await fetch("/api/admin/sandbox-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error ?? "Failed to save");
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
    const ok = await patchSettings({ sandbox_star_tiers: validation.tiers });
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
    await patchSettings({ sandbox_promotion_bonus_cp: validation.value });
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
    <>
      {/* ── Paliers ──────────────────────────────────────────────────── */}
      <div>
        <h2 className="v-pro-kicker">
          Star milestones
        </h2>

        <div className="space-y-2">
          {rows.length === 0 && (
            <p className="v-pro-empty">
              No milestone configured. Stars are a signal, and pay nothing.
            </p>
          )}

          {rows.map((row, index) => (
            <div
              key={index}
              className="v-pro-switch-row" style={{ flexWrap: "wrap" }}
            >
              <Star className="h-4 w-4 shrink-0 text-yellow-400" />
              <label className="v-pro-tier-label">
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
              <label className="v-pro-tier-label">
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
                className="v-pro-remove"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            className="v-pro-btn-quiet"
            onClick={() => setRows((current) => [...current, { stars: "", cp: "" }])}
          >
            <Plus />
            Add milestone
          </button>
          <button className="v-pro-btn" onClick={saveTiers} disabled={savingTiers}>
            {savingTiers ? "Saving…" : "Save milestones"}
          </button>
          {tiersMessage && <span className="v-pro-saved">{tiersMessage}</span>}
        </div>

        <p className="v-pro-tier-note">
          Thresholds must strictly increase. A milestone is paid once per sandbox and is never
          clawed back - unstarring reverses nothing. Lowering a threshold below a sandbox&apos;s
          current count does not pay it retroactively: it is paid on that sandbox&apos;s next star.
        </p>
      </div>

      {/* ── Bonus de promotion ───────────────────────────────────────── */}
      <div>
        <h2 className="v-pro-kicker">
          Promotion bonus
        </h2>
        <div className="v-pro-switch-row">
          <div className="flex min-w-0 items-center gap-3">
            <Trophy className="h-4 w-4 shrink-0 text-violet-400" />
            <div className="min-w-0">
              <p className="v-pro-switch-label">CP paid when a sandbox is promoted</p>
              <p className="v-pro-switch-desc">
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

      {error && <p className="v-pro-error">{error}</p>}

      {/* ── Audit ────────────────────────────────────────────────────── */}
      <div>
        <h2 className="v-pro-kicker">
          Star audit
        </h2>

        <select
          value={selectedId}
          onChange={(e) => selectSandbox(e.target.value)}
          className="v-pro-input"
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
          <p className="v-pro-note">No sandbox yet.</p>
        )}

        {audit && (
          <div className="mt-4 space-y-5">
            <p className="v-pro-note">
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
                    className="v-pro-switch-row" style={{ flexWrap: "wrap", fontSize: "0.75rem", padding: "0.6rem 1rem" }}
                  >
                    <span className="v-pro-digest-strong">{group.day}</span>
                    <span className="v-pro-digest-weak">{group.origin}</span>
                    <span className="v-pro-mono">
                      {group.ip_hash_prefix ?? "no ip"}
                    </span>
                    <span className="v-pro-digest-weak">
                      {group.count} row{group.count !== 1 ? "s" : ""} · {group.active} active
                      {group.attached > 0 ? ` · ${group.attached} attached` : ""}
                    </span>
                    <button
                      type="button"
                      onClick={() => deleteSelectedStars(group.star_uuids)}
                      disabled={auditBusy}
                      className="v-pro-remove" style={{ fontWeight: 700 }}
                    >
                      Delete group
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Lignes brutes : c'est par `uuid` que la suppression se fait. */}
            {audit.stars.length > 0 && (
              <div className="v-pro-table">
                <table className="w-full text-left text-xs">
                  <thead className="v-pro-thead-row">
                    <tr>
                      <th className="w-8 px-3 py-2" />
                      <th className="px-3 py-2 font-medium">Day</th>
                      <th className="px-3 py-2 font-medium">Origin</th>
                      <th className="px-3 py-2 font-medium">IP hash</th>
                      <th className="px-3 py-2 font-medium">State</th>
                    </tr>
                  </thead>
                  <tbody className="v-pro-tbody">
                    {audit.stars.map((star) => (
                      <tr key={star.uuid}>
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
                        <td className="v-pro-mono">
                          {star.ip_hash_prefix ?? "-"}
                        </td>
                        <td className="px-3 py-2">
                          {star.removed_at ? (
                            <span className="v-pro-digest-weak">removed</span>
                          ) : (
                            <span style={{ color: "var(--v-accent)" }}>active</span>
                          )}
                          {star.attached_at && (
                            <span className="v-pro-digest-weak" style={{ marginLeft: "0.35rem" }}>attached</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {selectedStars.size > 0 && (
              <button
                className="v-pro-btn-danger"
                onClick={() => deleteSelectedStars([...selectedStars])}
                disabled={auditBusy}
              >
                <Trash2 />
                Delete {selectedStars.size} selected star{selectedStars.size > 1 ? "s" : ""}
              </button>
            )}

            {/* Ledger : supprimer une ligne *est* la reprise des CP, le total
                d'un contributeur étant un SUM en direct sans cache. */}
            <div>
              <h3 className="v-pro-label">
                Ledger
              </h3>
              {rewards && rewards.length > 0 ? (
                <div className="space-y-1.5">
                  {rewards.map((reward) => (
                    <div
                      key={reward.uuid}
                      className="v-pro-switch-row" style={{ flexWrap: "wrap", fontSize: "0.75rem", padding: "0.6rem 1rem" }}
                    >
                      {reward.rule_key === "promotion" ? (
                        <Trophy className="h-3.5 w-3.5 text-violet-400" />
                      ) : (
                        <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                      )}
                      <span className="v-pro-digest-strong">
                        {reward.rule_key === "promotion"
                          ? "Promotion"
                          : `${reward.tier_stars} stars milestone`}
                      </span>
                      <span style={{ fontWeight: 700, color: "var(--v-accent)" }}>
                        +{formatCP(reward.points)} CP
                      </span>
                      <span className="v-pro-digest-weak">
                        {reward.created_at ? reward.created_at.slice(0, 10) : "-"}
                      </span>
                      <button
                        type="button"
                        onClick={() => deleteReward(reward.uuid)}
                        disabled={auditBusy}
                        className="v-pro-remove" style={{ fontWeight: 700 }}
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="v-pro-note">
                  Nothing paid on this sandbox yet.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
