"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { SandboxView } from "@/lib/public/sandbox";
import { useSlugField } from "@/lib/useSlugField";
import type { SlugFieldController } from "@/lib/useSlugField";
import { IMAGE_ACCEPT, useImageUpload } from "@/lib/useImageUpload";
import { vitrineFontVars } from "@/components/vitrine/fonts";
import { formatGoals, goalsError, parseGoals } from "./goalsField";

import "@/components/vitrine/vitrine.css";
import "./sandbox-vitrine.css";

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
  /**
   * D'où la modale doit sembler sortir : le rectangle du bouton cliqué. La
   * maquette anime le trajet bouton → carte centrée, comme une fenêtre
   * d'application sur macOS.
   */
  origin?: { x: number; y: number; w: number } | null;
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
  cover: string;
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
  cover: "",
};

/** Le même filtre que `httpUrl` côté Zod : un repo ou un dataset se visite. */
function isHttpUrl(value: string): boolean {
  return /^https?:\/\/.+/i.test(value.trim());
}

const CodeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 18 22 12 16 6" />
    <polyline points="8 6 2 12 8 18" />
  </svg>
);

const MlIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 4.5a2.5 2.5 0 0 0-5 0 2.5 2.5 0 0 0-1.5 4.5A2.5 2.5 0 0 0 5 13.5a2.5 2.5 0 0 0 2 4 2.5 2.5 0 0 0 5 .5z" />
    <path d="M12 4.5a2.5 2.5 0 0 1 5 0 2.5 2.5 0 0 1 1.5 4.5A2.5 2.5 0 0 1 19 13.5a2.5 2.5 0 0 1-2 4 2.5 2.5 0 0 1-5 .5z" />
    <line x1="12" y1="4.5" x2="12" y2="18.5" />
    <circle cx="8.5" cy="9" r="1" />
    <circle cx="15.5" cy="13.5" r="1" />
  </svg>
);

const TYPE_OPTIONS: { key: SandboxType; label: string; hint: string; Icon: () => React.JSX.Element }[] = [
  { key: "code", label: "Code", hint: "A repository to build on", Icon: CodeIcon },
  { key: "ml", label: "ML", hint: "Dataset, model, evaluation", Icon: MlIcon },
];

/**
 * La modale de proposition — création, et édition par l'auteur.
 * D'après `Sandbox Redesign Vitrine.dc.html`, animation d'ouverture comprise.
 *
 * Un seul composant pour les deux modes : les champs sont les mêmes, seuls le
 * titre, le verbe HTTP et le verrouillage du type changent.
 */
export function CreateSandboxModal({ open, onClose, sandbox, onSaved, origin }: CreateSandboxModalProps) {
  const isEdit = !!sandbox;
  const [form, setForm] = useState<FormState>(EMPTY);
  const [mounted, setMounted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cover = useImageUpload();

  // Dérivé du titre à la création ; en édition, le slug actuel, que le titre ne
  // touche plus. Le modifier laisse l'ancienne adresse en redirection.
  const slugField = useSlugField("sandbox", form.title);
  const { reset: resetSlug } = slugField;

  // Portail vers `document.body` : une modale `fixed` rendue dans un sous-arbre
  // porteur d'une transformation se retrouverait confinée dans la boîte de cet
  // ancêtre au lieu du viewport.
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
            cover: sandbox.cover_image_url ?? "",
          }
        : EMPTY,
    );
  }, [open, sandbox, resetSlug]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /**
   * L'ouverture depuis le bouton cliqué, comme une fenêtre d'application sur
   * macOS : on mesure le trajet bouton → carte centrée, et on l'anime.
   * `dir = 1` à l'ouverture, `-1` à la fermeture.
   */
  const play = (dir: 1 | -1) => {
    const card = cardRef.current;
    const backdrop = backdropRef.current;
    if (!card) return null;

    const rect = card.getBoundingClientRect();
    const dx = origin ? origin.x - (rect.left + rect.width / 2) : 0;
    const dy = origin ? origin.y - (rect.top + rect.height / 2) : 40;
    const scale = origin ? Math.max(0.12, Math.min(0.5, origin.w / Math.max(1, rect.width))) : 0.9;
    const tr = (px: number, py: number, sc: number) =>
      `translate3d(${px}px,${py}px,0) scale(${sc})`;

    if (backdrop) {
      backdrop.animate([{ opacity: dir > 0 ? 0 : 1 }, { opacity: dir > 0 ? 1 : 0 }], {
        duration: dir > 0 ? 420 : 240,
        easing: "ease-out",
        fill: "both",
      });
    }

    if (dir > 0) {
      // Le ressort de macOS : une détente franche, un léger dépassement, puis
      // le repos. Le flou de départ fait le reste du « genie ».
      return card.animate(
        [
          { transform: tr(dx, dy, scale), opacity: 0.15, filter: "blur(7px)", easing: "cubic-bezier(0.2,0.9,0.25,1)" },
          {
            offset: 0.5,
            transform: tr(dx * 0.16, dy * 0.16, scale + (1 - scale) * 0.86),
            opacity: 1,
            filter: "blur(1.5px)",
            easing: "cubic-bezier(0.25,1,0.3,1)",
          },
          { offset: 0.74, transform: tr(0, 0, 1.016), filter: "blur(0px)", easing: "cubic-bezier(0.4,0,0.4,1)" },
          { offset: 0.88, transform: tr(0, 0, 0.996), easing: "ease-out" },
          { transform: tr(0, 0, 1), opacity: 1, filter: "blur(0px)" },
        ],
        { duration: 620, fill: "both" },
      );
    }

    return card.animate(
      [
        { transform: tr(0, 0, 1), opacity: 1, filter: "blur(0px)" },
        { transform: tr(dx, dy, scale), opacity: 0, filter: "blur(5px)" },
      ],
      { duration: 260, easing: "cubic-bezier(0.45,0,0.7,1)", fill: "both" },
    );
  };

  // Jouée après le montage de la carte, comme dans la maquette.
  useEffect(() => {
    if (!open || !mounted) return;
    const frame = requestAnimationFrame(() => play(1));
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mounted]);

  const close = () => {
    const animation = play(-1);
    if (!animation) {
      onClose();
      return;
    }
    animation.onfinish = () => onClose();
  };

  if (!open || !mounted) return null;

  const isMl = form.type === "ml";
  const goals = parseGoals(form.goals);
  const goalsProblem = goalsError(goals);
  const fieldsMissing =
    form.title.trim().length < 3 || !isHttpUrl(form.repo) || (isMl && !isHttpUrl(form.dataset));
  const valid =
    !fieldsMissing &&
    (!isMl || !form.model.trim() || isHttpUrl(form.model)) &&
    !goalsProblem &&
    slugField.ready;

  const patch = (changes: Partial<FormState>) => setForm((current) => ({ ...current, ...changes }));

  const pickCover = async (file: File | undefined) => {
    if (!file) return;
    const url = await cover.upload(file);
    if (url) patch({ cover: url });
  };

  const submit = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    setError(null);

    const context = form.context.trim();
    const why = form.why.trim();
    const model = form.model.trim();
    const dataset = form.dataset.trim();
    const coverUrl = form.cover.trim();

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
            cover_image_url: coverUrl || null,
            ...(isMl ? { model_url: model || null, dataset_urls: dataset ? [dataset] : [] } : {}),
          }
        : {
            type: form.type,
            title: form.title.trim(),
            slug: slugField.submitValue,
            ...(context ? { context } : {}),
            goals,
            ...(why ? { why } : {}),
            repo_url: form.repo.trim(),
            ...(coverUrl ? { cover_image_url: coverUrl } : {}),
            // Un sandbox `code` refuse modèle et datasets côté schéma : on ne
            // les envoie même pas, plutôt que d'envoyer des tableaux vides.
            ...(isMl ? { dataset_urls: [dataset], ...(model ? { model_url: model } : {}) } : {}),
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
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t save this sandbox.");
    } finally {
      setSubmitting(false);
    }
  };

  const hint = !valid
    ? !fieldsMissing && !slugField.ready
      ? "Choose an available address."
      : isMl
        ? "A title, a repository and a dataset URL are required."
        : "A title and a repository URL are required."
    : isEdit
      ? "The type stays as it is — it drives the fields and the grid."
      : "Goes live as open, right away. The type carries over on promotion.";

  return createPortal(
    <div className={`vitrine v-sandbox ${vitrineFontVars}`}>
      <div className="v-modal">
        <div ref={backdropRef} className="v-modal-backdrop" onClick={close} aria-hidden />

        <div ref={cardRef} className="v-modal-card" role="dialog" aria-modal="true">
          <div className="v-modal-head">
            <div className="v-modal-head-text">
              <h2 className="v-modal-title">{isEdit ? "Edit sandbox" : "New sandbox"}</h2>
              <p className="v-modal-sub">
                {isEdit
                  ? "Your proposal, as the community reads it. Stars and paid milestones are untouched."
                  : "Health domain only. It goes live immediately — no approval needed."}
              </p>
            </div>
            <button type="button" className="v-modal-close" onClick={close} aria-label="Close">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Le type d'abord : c'est lui qui décide des champs qui suivent. */}
          <div className="v-types">
            <span className="v-types-label">Sandbox type</span>
            <div className="v-types-row">
              {TYPE_OPTIONS.map(({ key, label, hint: typeHint, Icon }) => (
                <button
                  key={key}
                  type="button"
                  className="v-type"
                  data-on={form.type === key ? "true" : "false"}
                  data-locked={isEdit ? "true" : "false"}
                  disabled={isEdit}
                  onClick={() => patch({ type: key })}
                >
                  <Icon />
                  <span className="v-type-text">
                    <span className="v-type-name">{label}</span>
                    <span className="v-type-hint">{typeHint}</span>
                  </span>
                </button>
              ))}
            </div>
            {isEdit && <span className="v-type-hint">The type is locked after creation.</span>}
          </div>

          <label className="v-field">
            <span className="v-field-label">Title</span>
            <input
              type="text"
              value={form.title}
              onChange={(event) => patch({ title: event.target.value })}
              placeholder="e.g. Sleep apnea screening from a phone microphone"
            />
          </label>

          {/* Pas dans un <label> : la ligne d'état porte un bouton (« Use … »)
              qu'un label détournerait vers l'input. */}
          <div className="v-field">
            <span className="v-field-label">
              Address <span className="v-field-hint">— the link people will share</span>
            </span>
            <div className="v-slug">
              <span className="v-slug-prefix">/sandbox/</span>
              <input
                type="text"
                value={slugField.value}
                onChange={(event) => slugField.onChange(event.target.value)}
                onBlur={slugField.onBlur}
                placeholder="sleep-apnea-screening"
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                className="v-bare"
              />
              <SlugState field={slugField} />
            </div>
          </div>

          <label className="v-field">
            <span className="v-field-label">Context</span>
            <textarea
              rows={4}
              value={form.context}
              onChange={(event) => patch({ context: event.target.value })}
              placeholder="Why this problem exists, and where you are with it. Markdown supported."
            />
          </label>

          <label className="v-field">
            <span className="v-field-label">
              What I want to build <span className="v-field-hint">— one goal per line</span>
            </span>
            <textarea
              rows={3}
              value={form.goals}
              onChange={(event) => patch({ goals: event.target.value })}
              placeholder={"A reproducible pipeline from raw audio to labels\nA baseline model with honest validation"}
            />
            {goalsProblem && <span className="v-field-error">{goalsProblem}</span>}
          </label>

          <label className="v-field">
            <span className="v-field-label">Why it matters</span>
            <textarea
              rows={3}
              value={form.why}
              onChange={(event) => patch({ why: event.target.value })}
              placeholder="What changes for people if this exists. Markdown supported."
            />
          </label>

          {/* La couverture : l'image que portera la carte du listing. */}
          <div className="v-field">
            <span className="v-field-label">
              Cover image <span className="v-field-hint">— what the card will show</span>
            </span>
            <div className="v-cover">
              {form.cover ? (
                <div className="v-cover-preview">
                  {/* eslint-disable-next-line @next/next/no-img-element -- source libre : URL externe ou /api/images */}
                  <img src={form.cover} alt="" />
                  <button
                    type="button"
                    className="v-cover-remove"
                    onClick={() => patch({ cover: "" })}
                    aria-label="Remove the cover image"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              ) : (
                <button type="button" className="v-cover-drop" onClick={() => fileRef.current?.click()}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="3" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="m21 15-5-5L5 21" />
                  </svg>
                  <span className="v-cover-drop-title">
                    {cover.uploading ? "Uploading…" : "Upload a cover image"}
                  </span>
                  <span className="v-cover-drop-hint">PNG, JPEG, WebP — resized to 1600px</span>
                </button>
              )}

              <input
                ref={fileRef}
                type="file"
                accept={IMAGE_ACCEPT}
                style={{ display: "none" }}
                onChange={(event) => {
                  void pickCover(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />

              <div className="v-cover-row">
                <input
                  type="url"
                  value={form.cover}
                  onChange={(event) => patch({ cover: event.target.value })}
                  placeholder="…or paste an image URL"
                  style={{
                    width: "100%",
                    borderRadius: "12px",
                    border: "1px solid var(--v-line)",
                    background: "var(--v-surface)",
                    padding: "0.55rem 0.75rem",
                    fontSize: "0.75rem",
                    color: "var(--v-ink)",
                    outline: "none",
                  }}
                />
                {form.cover && (
                  <button type="button" className="v-cover-replace" onClick={() => fileRef.current?.click()}>
                    {cover.uploading ? "Uploading…" : "Replace"}
                  </button>
                )}
              </div>

              {cover.error && <span className="v-field-error">{cover.error}</span>}
            </div>
          </div>

          <div className="v-start">
            <span className="v-start-label">Starting point</span>

            <label className="v-field">
              <span className="v-field-label">Repository URL</span>
              <input
                type="url"
                value={form.repo}
                onChange={(event) => patch({ repo: event.target.value })}
                placeholder="https://github.com/you/your-repo"
              />
            </label>

            {isMl && (
              <>
                <label className="v-field">
                  <span className="v-field-label">Dataset URL</span>
                  <input
                    type="url"
                    value={form.dataset}
                    onChange={(event) => patch({ dataset: event.target.value })}
                    placeholder="https://…  a public dataset the twin can pull"
                  />
                </label>
                <label className="v-field">
                  <span className="v-field-label">
                    Model URL <span className="v-field-hint">— optional</span>
                  </span>
                  <input
                    type="url"
                    value={form.model}
                    onChange={(event) => patch({ model: event.target.value })}
                    placeholder="https://…  baseline weights, if you have any"
                  />
                </label>
              </>
            )}

            {/*
              Emplacement d'une fonctionnalité à venir : partir d'un kit de
              démarrage plutôt que d'un repo vide. Désactivé et sans aucune
              logique derrière — le montrer ici est délibéré, c'est ce qui dit
              à l'auteur que le champ « repository » n'est pas la seule porte
              d'entrée prévue.
            */}
            <div className="v-soon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
              </svg>
              <span className="v-soon-text">Start from a dev kit</span>
              <span className="v-soon-badge">SOON</span>
            </div>
          </div>

          {error && <p className="v-field-error">{error}</p>}

          <div className="v-modal-actions">
            <button
              type="button"
              className="v-modal-submit"
              data-valid={valid && !submitting ? "true" : "false"}
              disabled={!valid || submitting}
              onClick={submit}
            >
              {submitting ? "Saving…" : isEdit ? "Save changes" : "Create sandbox"}
            </button>
            <button type="button" className="v-modal-cancel" onClick={close}>
              Cancel
            </button>
            <span className="v-modal-hint">{hint}</span>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** L'état du slug, dans la typographie de la maquette. */
function SlugState({ field }: { field: SlugFieldController }) {
  const { check } = field.state;

  switch (check.status) {
    case "checking":
      return <span className="v-slug-state">Checking…</span>;
    case "unverified":
      return <span className="v-slug-state">Checked on save</span>;
    case "available":
      return (
        <span className="v-slug-state" data-ok="true">
          Available
        </span>
      );
    case "taken":
    case "invalid":
      return check.suggestion ? (
        <button type="button" className="v-slug-use" onClick={field.applySuggestion}>
          Use {check.suggestion}
        </button>
      ) : (
        <span className="v-slug-state">{check.message}</span>
      );
    default:
      return field.value.length > 0 && field.value.length < 3 ? (
        <span className="v-slug-state">Too short</span>
      ) : null;
  }
}
