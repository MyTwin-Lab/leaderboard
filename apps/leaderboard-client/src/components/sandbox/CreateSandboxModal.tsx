"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Box, BrainCircuit, Code2, X } from "lucide-react";
import type { SandboxView } from "@/lib/public/sandbox";
import { useSlugField } from "@/lib/useSlugField";
import { SlugField } from "@/components/ui/SlugField";
import { formatGoals, goalsError, parseGoals } from "./goalsField";

interface CreateSandboxModalProps {
  open: boolean;
  onClose: () => void;
  /**
   * En édition, la proposition à modifier. Le `type` est alors verrouillé :
   * il est figé à la création, parce qu'il a déjà déterminé les champs saisis
   * et la grille d'évaluation. C'est la même règle côté API — `type` n'est pas
   * dans `sandboxUpdateSchema`.
   */
  sandbox?: SandboxView | null;
  onSaved: (sandbox: SandboxView) => void;
}

type SandboxType = "code" | "ml";

interface FormState {
  type: SandboxType;
  title: string;
  context: string;
  goals: string;
  why: string;
  repo: string;
  dataset: string;
  model: string;
}

const EMPTY: FormState = {
  type: "code",
  title: "",
  context: "",
  goals: "",
  why: "",
  repo: "",
  dataset: "",
  model: "",
};

/** Le même filtre que `httpUrl` côté Zod : un repo ou un dataset se visite. */
function isHttpUrl(value: string): boolean {
  return /^https?:\/\/.+/i.test(value.trim());
}

const TYPE_OPTIONS: { key: SandboxType; label: string; hint: string; icon: typeof Code2 }[] = [
  { key: "code", label: "Code", hint: "A repository to build on", icon: Code2 },
  { key: "ml", label: "ML", hint: "Dataset, model, evaluation", icon: BrainCircuit },
];

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-white/70">
        {label}
        {hint && <span className="font-normal text-white/30"> - {hint}</span>}
      </span>
      {children}
    </label>
  );
}

const INPUT_CLASS =
  "w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder:text-white/25 transition-colors focus:border-brandCP/50 focus:outline-none";

/**
 * La modale de proposition — création, et édition par l'auteur.
 *
 * Un seul composant pour les deux : les champs sont les mêmes, seuls le titre,
 * le verbe HTTP et le verrouillage du type changent. Deux composants auraient
 * divergé au premier champ ajouté.
 *
 * Le formulaire porte les **trois sections** de la proposition — contexte,
 * buts, pourquoi — et non un markdown unique : chacune est rendue séparément
 * sur la page détail, et les buts pré-rempliront les tâches du challenge à la
 * promotion.
 */
export function CreateSandboxModal({ open, onClose, sandbox, onSaved }: CreateSandboxModalProps) {
  const isEdit = !!sandbox;
  const [form, setForm] = useState<FormState>(EMPTY);
  const [mounted, setMounted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Dérivé du titre à la création ; en édition, le slug actuel, que le titre ne
  // touche plus. Le modifier laisse l'ancienne adresse en redirection.
  const slugField = useSlugField("sandbox", form.title);
  const { reset: resetSlug } = slugField;

  // Portail vers `document.body` : une modale `fixed` rendue dans un sous-arbre
  // porteur d'une transformation (`animate-fade-up`) se retrouverait confinée
  // dans la boîte de cet ancêtre au lieu du viewport.
  useEffect(() => {
    setMounted(true);
  }, []);

  // Réinitialisé à chaque ouverture : rouvrir après un abandon ne doit pas
  // ressortir la saisie précédente, et l'édition doit repartir du serveur.
  useEffect(() => {
    if (!open) return;
    setError(null);
    resetSlug(
      sandbox
        ? { title: sandbox.title, value: sandbox.slug, saved: sandbox.slug, excludeId: sandbox.uuid }
        : { title: "" },
    );
    setForm(
      sandbox
        ? {
            type: (sandbox.type === "ml" ? "ml" : "code") as SandboxType,
            title: sandbox.title,
            context: sandbox.context ?? "",
            goals: formatGoals(sandbox.goals),
            why: sandbox.why ?? "",
            repo: sandbox.repo_url,
            dataset: sandbox.dataset_urls[0] ?? "",
            model: sandbox.model_url ?? "",
          }
        : EMPTY,
    );
  }, [open, sandbox, resetSlug]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  const isMl = form.type === "ml";
  const goals = parseGoals(form.goals);
  const goalsProblem = goalsError(goals);
  const valid =
    form.title.trim().length >= 3 &&
    isHttpUrl(form.repo) &&
    (!isMl || isHttpUrl(form.dataset)) &&
    (!isMl || !form.model.trim() || isHttpUrl(form.model)) &&
    !goalsProblem &&
    slugField.ready;

  const patch = (changes: Partial<FormState>) => setForm((current) => ({ ...current, ...changes }));

  const submit = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    setError(null);

    const context = form.context.trim();
    const why = form.why.trim();
    const model = form.model.trim();
    const dataset = form.dataset.trim();

    try {
      // En édition, `null` efface explicitement — d'où les champs nullables du
      // schéma d'update, là où la création se contente d'omettre.
      const body = isEdit
        ? {
            title: form.title.trim(),
            // Seulement s'il a changé : l'ancienne adresse devient une redirection.
            ...(slugField.changed ? { slug: slugField.submitValue } : {}),
            context: context || null,
            goals,
            why: why || null,
            repo_url: form.repo.trim(),
            ...(isMl
              ? { model_url: model || null, dataset_urls: dataset ? [dataset] : [] }
              : {}),
          }
        : {
            type: form.type,
            title: form.title.trim(),
            slug: slugField.submitValue,
            ...(context ? { context } : {}),
            goals,
            ...(why ? { why } : {}),
            repo_url: form.repo.trim(),
            // Un sandbox `code` refuse modèle et datasets côté schéma : on ne
            // les envoie même pas, plutôt que d'envoyer des tableaux vides.
            ...(isMl
              ? { dataset_urls: [dataset], ...(model ? { model_url: model } : {}) }
              : {}),
          };

      const res = await fetch(isEdit ? `/api/sandboxes/${sandbox!.uuid}` : "/api/sandboxes", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        // Pris entre la vérification et l'envoi : le champ le montre, avec sa suggestion.
        if (res.status === 409 && payload?.field === "slug") {
          slugField.conflict(payload.error, payload.suggestion ?? null);
        }
        throw new Error(payload?.error ?? "Couldn’t save this sandbox.");
      }

      const payload = (await res.json()) as { sandbox: SandboxView };
      onSaved(payload.sandbox);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t save this sandbox.");
    } finally {
      setSubmitting(false);
    }
  };

  const fieldsMissing =
    form.title.trim().length < 3 ||
    !isHttpUrl(form.repo) ||
    (isMl && !isHttpUrl(form.dataset));
  const hint = !valid
    ? !fieldsMissing && !slugField.ready
      ? "Choose an available address."
      : isMl
        ? "A title, a repository and a dataset URL are required."
        : "A title and a repository URL are required."
    : isEdit
      ? "Type stays as it is - it drives the fields and the grid."
      : "Goes live as open, right away. The type carries over on promotion.";

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/60 px-5 py-8 backdrop-blur-sm sm:py-14">
      <div className="fixed inset-0" onClick={onClose} aria-hidden />

      <div className="animate-pop-in relative flex w-full max-w-lg flex-col gap-4 rounded-3xl border border-white/10 bg-background p-6 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="text-lg font-semibold tracking-tight text-white">
              {isEdit ? "Edit sandbox" : "New sandbox"}
            </h2>
            <p className="text-[13px] leading-relaxed text-white/50">
              {isEdit
                ? "Your proposal, as the community reads it. Stars and paid milestones are untouched."
                : "Health domain only. It goes live immediately - no approval needed."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ml-auto shrink-0 rounded-lg p-1.5 text-white/35 transition-colors hover:bg-white/5 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Le type d'abord : c'est lui qui décide des champs qui suivent. */}
        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
            Sandbox type
          </span>
          <div className="flex gap-2">
            {TYPE_OPTIONS.map(({ key, label, hint: typeHint, icon: Icon }) => {
              const active = form.type === key;
              return (
                <button
                  key={key}
                  type="button"
                  disabled={isEdit}
                  onClick={() => patch({ type: key })}
                  className={`flex min-w-0 flex-1 items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all duration-200 ${
                    active
                      ? "border-brandCP/40 bg-brandCP/10"
                      : "border-white/10 bg-white/[0.02] hover:border-white/20"
                  } ${isEdit ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
                >
                  <Icon
                    className={`h-4 w-4 shrink-0 ${active ? "text-brandCP" : "text-white/30"}`}
                  />
                  <span className="flex min-w-0 flex-col">
                    <span
                      className={`text-[13px] font-semibold ${active ? "text-white" : "text-white/50"}`}
                    >
                      {label}
                    </span>
                    <span className="text-[10px] leading-snug text-white/30">{typeHint}</span>
                  </span>
                </button>
              );
            })}
          </div>
          {isEdit && (
            <span className="text-[11px] text-white/30">
              The type is locked after creation.
            </span>
          )}
        </div>

        <Field label="Title">
          <input
            type="text"
            value={form.title}
            onChange={(e) => patch({ title: e.target.value })}
            placeholder="e.g. Sleep apnea screening from a phone microphone"
            className={INPUT_CLASS}
          />
        </Field>

        {/* Pas dans un <Field> : c'est un <label>, et la ligne d'état porte un
            bouton (« Use … ») qu'un label détournerait vers l'input. */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-white/70">
            Address
            <span className="font-normal text-white/30"> - the link people will share</span>
          </span>
          <SlugField field={slugField} />
        </div>

        <Field label="Context">
          <textarea
            rows={4}
            value={form.context}
            onChange={(e) => patch({ context: e.target.value })}
            placeholder="Why this problem exists, and where you are with it. Markdown supported."
            className={`${INPUT_CLASS} resize-y leading-relaxed`}
          />
        </Field>

        <Field label="What I want to build" hint="one goal per line">
          <textarea
            rows={3}
            value={form.goals}
            onChange={(e) => patch({ goals: e.target.value })}
            placeholder={"A reproducible pipeline from raw audio to labels\nA baseline model with honest validation"}
            className={`${INPUT_CLASS} resize-y leading-relaxed`}
          />
          {goalsProblem && <span className="text-[11px] text-red-400">{goalsProblem}</span>}
        </Field>

        <Field label="Why it matters">
          <textarea
            rows={3}
            value={form.why}
            onChange={(e) => patch({ why: e.target.value })}
            placeholder="What changes for people if this exists. Markdown supported."
            className={`${INPUT_CLASS} resize-y leading-relaxed`}
          />
        </Field>

        <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/50">
            Starting point
          </span>

          <Field label="Repository URL">
            <input
              type="url"
              value={form.repo}
              onChange={(e) => patch({ repo: e.target.value })}
              placeholder="https://github.com/you/your-repo"
              className={INPUT_CLASS}
            />
          </Field>

          {isMl && (
            <>
              <Field label="Dataset URL">
                <input
                  type="url"
                  value={form.dataset}
                  onChange={(e) => patch({ dataset: e.target.value })}
                  placeholder="https://…  a public dataset the twin can pull"
                  className={INPUT_CLASS}
                />
              </Field>
              <Field label="Model URL" hint="optional">
                <input
                  type="url"
                  value={form.model}
                  onChange={(e) => patch({ model: e.target.value })}
                  placeholder="https://…  baseline weights, if you have any"
                  className={INPUT_CLASS}
                />
              </Field>
            </>
          )}

          {/*
            Emplacement d'une fonctionnalité à venir : partir d'un kit de
            démarrage plutôt que d'un repo vide. Désactivé et sans aucune
            logique derrière — le montrer ici est délibéré, c'est ce qui dit
            à l'auteur que le champ « repository » n'est pas la seule porte
            d'entrée prévue.
          */}
          <div className="flex items-center gap-2.5 rounded-xl border border-dashed border-white/12 px-3 py-2.5 opacity-60">
            <Box className="h-3.5 w-3.5 shrink-0 text-white/30" />
            <span className="text-xs text-white/35">Start from a dev kit</span>
            <span className="ml-auto rounded-full bg-white/[0.06] px-2.5 py-0.5 text-[10px] font-bold tracking-[0.08em] text-white/35">
              SOON
            </span>
          </div>
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={submit}
            disabled={!valid || submitting}
            className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-semibold transition-all duration-200 ${
              valid && !submitting
                // Même inversion que le tri du listing : un `bg-white` opaque
                // resterait blanc sur blanc en thème clair.
                ? "cursor-pointer bg-foreground text-background hover:opacity-90"
                : "cursor-not-allowed bg-white/[0.06] text-white/35"
            }`}
          >
            {submitting ? "Saving…" : isEdit ? "Save changes" : "Create sandbox"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-2 py-2.5 text-[13px] font-medium text-white/50 transition-colors hover:text-white"
          >
            Cancel
          </button>
          <span className="text-xs text-white/30">{hint}</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
