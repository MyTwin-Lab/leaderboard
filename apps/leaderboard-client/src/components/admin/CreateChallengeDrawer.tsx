'use client';

import { useState, useEffect, useRef } from 'react';
import {
  X, Trophy, CalendarDays, AlignLeft, Map, Loader2,
  CheckCircle2, ChevronDown, Plus, Pencil, FileText, Eye, Rocket,
} from 'lucide-react';
import { SelectDropdown } from '@/components/ui/SelectDropdown';
import { ChallengeSlackSignalsEditor } from '@/components/admin/ChallengeSlackSignalsEditor';
import { flushBrief } from './briefFlush';
import { buildPromotionRequestBody } from './promotionRequestBody';
import { Field, LockedValue, fgAt } from './challengeFormFields';
import { buildPromotedDescription } from '../../../../../packages/services/sandbox/promotion';
import { Markdown } from '@/components/ui/Markdown';
import { SlugField } from '@/components/ui/SlugField';
import { useSlugField } from '@/lib/useSlugField';
import { BRIEF_TEMPLATE, findBrief } from '@/lib/challengeBrief';
import type {
  EditableChallenge,
  FlowFormContext,
  FlowFormMode,
  PromotableSandbox,
  SavedChallenge,
} from '@/lib/flowFormSlots';
import { creatableFormSections, formSectionByKey, formSectionFor } from '@/distribution/mytwin.forms';

export type { EditableChallenge, PromotableSandbox, SavedChallenge } from '@/lib/flowFormSlots';

interface Project {
  id: string;
  name: string;
}

interface CreateChallengeDrawerProps {
  open: boolean;
  onClose: () => void;
  projects: Project[];
  /** Le challenge créé, promu ou enregistré : `uuid` pour les URLs admin, `slug` pour les pages publiques. */
  onCreated: (challenge: SavedChallenge) => void;
  /**
   * Present = edit mode. The project, the reward pool and the repo are locked:
   * they define the challenge's shape and its budget, and contributors are
   * already racing against both.
   */
  challenge?: EditableChallenge;
  /**
   * Présente = mode promotion, **exclusif** de `challenge`. Le tiroir crée un
   * challenge depuis une proposition : titre, description, type, buts et mode
   * de workspace sont pré-remplis, le type est verrouillé, et le formulaire
   * poste vers `/api/sandboxes/:id/promote` au lieu de `/api/challenges`.
   */
  promotion?: PromotableSandbox;
}

/** Date inputs need YYYY-MM-DD; the API hands back ISO strings or Dates. */
const toDateInput = (d: string | Date | null | undefined): string =>
  d ? new Date(d).toISOString().split('T')[0] : '';

const STATUS_OPTIONS = [
  { value: 'draft',     label: 'Draft',     dot: 'bg-white/25',   ring: 'ring-white/15'     },
  { value: 'active',    label: 'Active',    dot: 'bg-brandCP',    ring: 'ring-brandCP/30'   },
  { value: 'completed', label: 'Completed', dot: 'bg-green-500',  ring: 'ring-green-500/30' },
  { value: 'archived',  label: 'Archived',  dot: 'bg-white/10',   ring: 'ring-white/10'     },
];

/**
 * Le tiroir de challenge — création, édition et promotion d'un sandbox.
 *
 * Il porte les champs communs à tout challenge. Ce qui dépend du flow (sa
 * configuration, ses règles, ses éditeurs, ce qu'il ajoute au corps envoyé et
 * ce qu'il enregistre après coup) vient de la section du flow choisi, déclarée
 * par la distribution (`src/distribution/mytwin.forms.tsx`).
 */
export function CreateChallengeDrawer({ open, onClose, projects, onCreated, challenge, promotion }: CreateChallengeDrawerProps) {
  const isEdit = !!challenge;
  const isPromotion = !!promotion;
  const mode: FlowFormMode = isPromotion ? 'promotion' : isEdit ? 'edit' : 'create';
  // Le type décide des repos créés, et ils ne le sont qu'une fois : à
  // l'édition parce qu'ils existent déjà, à la promotion parce qu'il est
  // hérité de la proposition (elle a fixé les champs saisis et la grille).
  const typeLocked = isEdit || isPromotion;

  const [title, setTitle] = useState('');
  // Suit le titre à la création ; en édition et en promotion, part d'un slug
  // existant que le titre ne touche plus (voir lib/slugField.ts).
  const slugField = useSlugField('challenge', title);
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '');
  const [status, setStatus] = useState('draft');
  const [sectionKey, setSectionKey] = useState(creatableFormSections[0].key);
  // L'état de chaque section, par entrée : revenir sur une entrée retrouve sa saisie.
  const [flowStates, setFlowStates] = useState<Record<string, unknown>>({});
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [cp, setCp] = useState(100);
  const [description, setDescription] = useState('');
  const [roadmap, setRoadmap] = useState('');
  const [showRoadmap, setShowRoadmap] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  // Brief — le document Markdown affiché à un contributeur connecté qui n'a
  // pas encore rejoint le challenge. Bufferisé en création ; en édition il est
  // chargé depuis les documents du challenge. `existingBriefId` sert au cas
  // "brief vidé" : il faut alors supprimer le document, sinon la page
  // continuerait d'afficher l'ancien texte.
  const [brief, setBrief] = useState('');
  const [existingBriefId, setExistingBriefId] = useState<string | null>(null);
  const [showBrief, setShowBrief] = useState(false);
  const [briefPreview, setBriefPreview] = useState(false);

  // Set only when the challenge saved but something recorded afterwards
  // failed — the submit button turns into an explicit "Continue" the admin
  // must click, so the failure banner isn't wiped by an auto-navigate.
  const [pendingChallenge, setPendingChallenge] = useState<SavedChallenge | null>(null);

  const ctx: FlowFormContext = { mode, challenge, promotion, pool: cp, open };
  const section = formSectionByKey(sectionKey);
  const flowState = flowStates[section.key] ?? section.initialState(ctx);
  const patchFlowState = (patch: Record<string, unknown>) =>
    setFlowStates(prev => ({
      ...prev,
      [section.key]: { ...((prev[section.key] ?? section.initialState(ctx)) as object), ...patch },
    }));

  // L'état d'une section se pose une fois : recalculé à chaque rendu, il
  // donnerait de nouveaux objets de règles aux éditeurs à chaque frappe.
  useEffect(() => {
    if (flowStates[section.key] !== undefined) return;
    setFlowStates(prev => (prev[section.key] !== undefined ? prev : { ...prev, [section.key]: section.initialState(ctx) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section.key, flowStates]);

  // Fires on the false → true transition only. Callers pass a freshly spread
  // `challenge` object, so keying this on its identity would refill the form —
  // and wipe whatever is being typed — on every parent re-render.
  const wasOpen = useRef(false);
  useEffect(() => {
    const justOpened = open && !wasOpen.current;
    wasOpen.current = open;
    if (!justOpened) return;

    setSuccess(false);
    setError('');
    setPendingChallenge(null);
    setTimeout(() => titleRef.current?.focus(), 80);

    if (challenge) {
      setTitle(challenge.title);
      slugField.reset({ title: challenge.title, value: challenge.slug, saved: challenge.slug, excludeId: challenge.uuid });
      setProjectId(challenge.project_id);
      setStatus(challenge.status);
      setStartDate(toDateInput(challenge.start_date));
      setEndDate(toDateInput(challenge.end_date));
      setCp(challenge.contribution_points_reward);
      setDescription(challenge.description ?? '');
      setRoadmap(challenge.roadmap ?? '');
      setShowRoadmap(!!challenge.roadmap);
      const edited = formSectionFor(challenge.type);
      setSectionKey(edited.key);
      setFlowStates({ [edited.key]: edited.initialState({ mode: 'edit', challenge, pool: challenge.contribution_points_reward, open }) });
    } else if (promotion) {
      setTitle(promotion.title);
      // Les espaces de noms sont séparés : `/sandbox/mykine` peut devenir
      // `/challenges/mykine`. La vérification dira s'il est déjà pris.
      slugField.reset({ title: promotion.title, value: promotion.slug });
      const promoted = formSectionFor(promotion.type);
      setSectionKey(promoted.key);
      setFlowStates({ [promoted.key]: promoted.initialState({ mode: 'promotion', promotion, pool: cp, open }) });
      // La description markdown est composée par la même fonction que le
      // serveur, pour que ce que l'admin relit soit exactement ce qui serait
      // écrit s'il n'y touchait pas.
      setDescription(buildPromotedDescription({
        context: promotion.context ?? null,
        goals: promotion.goals ?? [],
        why: promotion.why ?? null,
      }));
      // Promouvoir, c'est ouvrir le challenge — pas préparer un brouillon.
      setStatus('active');
      // Le tiroir s'ouvre après le chargement des projets : sans ça, l'état
      // initial (`projects[0]` au premier rendu) resterait vide.
      setProjectId((current) => current || projects[0]?.id || '');
    }
  }, [open, challenge, promotion]);

  // Le brief vit dans les documents du challenge, pas dans sa ligne : en
  // édition il faut aller le chercher. Silencieux en cas d'échec — le tiroir
  // reste utilisable pour tout le reste, le brief s'affiche simplement vide.
  useEffect(() => {
    if (!open || !challenge) return;
    let cancelled = false;
    fetch(`/api/challenges/${challenge.uuid}/documents`)
      .then(r => r.ok ? r.json() : [])
      .then((docs: { uuid: string; filename: string; content: string }[]) => {
        if (cancelled) return;
        const found = findBrief(Array.isArray(docs) ? docs : []);
        setBrief(found?.content ?? '');
        setExistingBriefId(found?.uuid ?? null);
        setShowBrief(!!found);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [open, challenge]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const resetForm = () => {
    setTitle('');
    slugField.reset({ title: '' });
    setProjectId(projects[0]?.id ?? '');
    setStatus('draft');
    setSectionKey(creatableFormSections[0].key);
    setFlowStates({});
    setStartDate('');
    setEndDate('');
    setCp(100);
    setDescription('');
    setRoadmap('');
    setShowRoadmap(false);
    setPendingChallenge(null);
    setBrief('');
    setExistingBriefId(null);
    setShowBrief(false);
    setBriefPreview(false);
  };

  /** Admin has read the partial-failure banner and clicked Continue. */
  const handleAcknowledgeFailure = () => {
    const saved = pendingChallenge;
    if (!saved) return;
    resetForm();
    onCreated(saved);
    onClose();
  };

  const handleSubmit = async () => {
    if (!title.trim() || !projectId) {
      setError('Title and project are required.');
      return;
    }
    // Dates are optional, but an ordering that makes no sense still is one.
    if (startDate && endDate && new Date(endDate) <= new Date(startDate)) {
      setError('End date must be after start date.');
      return;
    }
    const sectionProblem = section.validate?.(flowState, ctx);
    if (sectionProblem) {
      setError(sectionProblem);
      return;
    }
    if (!slugField.ready) {
      setError(slugField.state.check.status === 'checking'
        ? 'Still checking the address - try again in a moment.'
        : 'Choose an available address for this challenge.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const shared = {
        title: title.trim(),
        status,
        start_date: startDate || null,
        end_date: endDate || null,
        description: description.trim() || undefined,
        roadmap: roadmap.trim() || undefined,
      };
      // Ce que le flow ajoute : son type à la création, ses champs de
      // configuration et ses règles.
      const flowFields = section.body(flowState, ctx);

      // Editing never touches the project or the pool: they define the
      // challenge's budget, and contributors are already racing against it.
      // Omitting them means the API cannot change them. La promotion a sa
      // propre route et son propre corps (`promotionRequestBody.ts`).
      const res = await fetch(
        isPromotion
          ? `/api/sandboxes/${promotion!.uuid}/promote`
          : isEdit
            ? `/api/challenges/${challenge!.uuid}`
            : '/api/challenges',
        {
          method: isEdit ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            isPromotion
              ? buildPromotionRequestBody(
                  { title, slug: slugField.submitValue, status, startDate, endDate, description, roadmap, cp, projectId },
                  flowFields,
                )
              : isEdit
                // Envoyé seulement s'il a changé : l'ancien devient une redirection.
                ? { ...shared, ...flowFields, ...(slugField.changed ? { slug: slugField.submitValue } : {}) }
                : {
                    ...shared,
                    slug: slugField.submitValue,
                    project_id: projectId,
                    contribution_points_reward: cp,
                    ...flowFields,
                  }
          ),
        }
      );

      if (res.ok) {
        // Création, promotion et édition renvoient toutes la ligne complète.
        const data = await res.json();
        const saved: SavedChallenge = { uuid: data.uuid, slug: data.slug };

        // Ce que le flow enregistre une fois le challenge créé (les tâches du
        // template, par exemple). Non bloquant : le challenge est déjà là.
        const problems = section.afterSave ? await section.afterSave(saved, flowState, ctx) : [];

        // Le brief est un document : même contrainte (pas d'uuid avant la
        // création), même traitement de l'échec.
        if (saved.uuid && (brief.trim() || existingBriefId)) {
          if (!(await flushBrief(saved.uuid, brief, existingBriefId)).ok) problems.push('the brief failed to save');
        }

        setSuccess(true);

        if (problems.length > 0) {
          // The challenge saved fine, but silently auto-navigating away (the
          // normal success path) would carry the admin off before they ever
          // see this. Hold here — no resetForm/onCreated/onClose — until they
          // click Continue in the footer.
          setError(`Challenge ${isEdit ? 'updated' : 'created'}, but ${problems.join(' and ')} - fix ${problems.length > 1 ? 'them' : 'it'} from the edit drawer.`);
          setPendingChallenge(saved);
        } else {
          setTimeout(() => {
            if (!isEdit) resetForm();
            onCreated(saved);
            onClose();
          }, 900);
        }
      } else {
        const d = await res.json().catch(() => ({}));
        // Pris entre la vérification et l'envoi : le champ le montre, avec sa suggestion.
        if (res.status === 409 && d.field === 'slug') slugField.conflict(d.error, d.suggestion ?? null);
        setError(d.error || `Failed to ${isPromotion ? 'promote this sandbox' : isEdit ? 'update' : 'create'} challenge`);
      }
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  };

  const projectOptions = projects.map(p => ({ value: p.id, label: p.name }));
  const SectionFields = section.Fields;
  const SectionDetails = section.Details;

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
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brandCP/15">
              {isPromotion
                ? <Rocket className="h-3.5 w-3.5 text-brandCP" />
                : isEdit
                  ? <Pencil className="h-3.5 w-3.5 text-brandCP" />
                  : <Plus className="h-4 w-4 text-brandCP" />}
            </div>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
              {isPromotion ? 'Promote to challenge' : isEdit ? 'Edit challenge' : 'New challenge'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-white/[0.06]"
            style={{ color: fgAt(0.3) }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-7">

          {/* ── Effets de la promotion ──
              Dit une fois, en tête : promouvoir n'est pas « créer un challenge
              de plus », c'est une opération qui touche la proposition, son
              auteur et le pool. L'admin doit le lire avant de valider. */}
          {isPromotion && (
            <div className="space-y-2 rounded-xl border border-brandCP/25 bg-brandCP/[0.06] px-4 py-3.5">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-brandCP">
                <Rocket className="h-3.5 w-3.5" />
                What promoting does
              </p>
              <ul className="space-y-1 text-[11px] leading-relaxed" style={{ color: fgAt(0.5) }}>
                <li>• Creates this challenge and closes the sandbox as <strong>Promoted</strong> - for good.</li>
                <li>• The author joins as a member, with their repository already declared.</li>
                <li>• The work already submitted becomes contributions and gets scored on this pool.</li>
                <li>• The promotion bonus is paid to the author, per the Sandbox settings.</li>
                <li>• The type stays the sandbox&apos;s - it decides the steps and the grid.</li>
              </ul>
            </div>
          )}

          {/* ── Title ── */}
          <div className="space-y-1.5">
            <input
              ref={titleRef}
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Challenge title…"
              className="w-full bg-transparent text-xl font-bold focus:outline-none"
              style={{ color: 'var(--foreground)' }}
            />
            <div className="h-px bg-white/[0.06] transition-all focus-within:bg-brandCP/30" />
          </div>

          {/* ── Address ── */}
          <Field label="Address">
            <SlugField field={slugField} />
          </Field>

          {/* ── Type ── */}
          {/* Locked on edit: the type decides which repos are created, and they
              only get created once, at creation. Locked on promotion too, for
              the same reason seen from the other end: it is inherited from the
              sandbox, which already fixed the fields and the grid. */}
          <Field label="Type">
            <div className="flex gap-2">
              {creatableFormSections.map(opt => {
                const Icon = opt.icon;
                const active = section.key === opt.key;
                if (typeLocked && !active) return null;
                return (
                  <button
                    key={opt.key}
                    onClick={() => !typeLocked && setSectionKey(opt.key)}
                    disabled={typeLocked}
                    className={`flex flex-1 items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all duration-200 ${
                      active
                        ? 'border-brandCP/40 bg-brandCP/10 ring-1 ring-brandCP/20'
                        : 'border-white/[0.06] bg-white/[0.02] hover:border-white/15'
                    } ${typeLocked ? 'cursor-default' : ''}`}
                  >
                    <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-brandCP' : ''}`} style={active ? undefined : { color: fgAt(0.3) }} />
                    <div>
                      <p className="text-sm font-semibold" style={{ color: active ? 'var(--foreground)' : fgAt(0.5) }}>{opt.label}</p>
                      <p className="text-[10px]" style={{ color: fgAt(0.3) }}>{opt.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </Field>

          {/* ── Project ── */}
          <Field icon={<ChevronDown className="h-3.5 w-3.5" />} label="Project">
            {isEdit ? (
              <LockedValue text={projects.find(p => p.id === projectId)?.name ?? '-'} />
            ) : (
              <SelectDropdown
                options={projectOptions}
                value={projectId}
                onChange={setProjectId}
              />
            )}
          </Field>

          {/* ── Status ── */}
          <Field label="Status">
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setStatus(opt.value)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                    status === opt.value
                      ? `border-white/20 bg-white/[0.08] ring-1 ${opt.ring}`
                      : 'border-white/[0.06] bg-white/[0.02] hover:border-white/15'
                  }`}
                  style={{ color: status === opt.value ? 'var(--foreground)' : fgAt(0.4) }}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${opt.dot}`} />
                  {opt.label}
                </button>
              ))}
            </div>
          </Field>

          {/* ── Dates ── */}
          <Field icon={<CalendarDays className="h-3.5 w-3.5" />} label="Timeline">
            <div className="flex items-center gap-3">
              <div className="flex-1 space-y-1">
                <p className="text-[10px] font-medium uppercase tracking-widest" style={{ color: fgAt(0.25) }}>Start</p>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm focus:border-brandCP/40 focus:outline-none focus:shadow-[0_0_0_1px_rgba(10,247,193,0.15)]"
                  style={{ color: 'var(--foreground)', colorScheme: 'auto' }}
                />
              </div>
              <span className="mt-5" style={{ color: fgAt(0.2) }}>→</span>
              <div className="flex-1 space-y-1">
                <p className="text-[10px] font-medium uppercase tracking-widest" style={{ color: fgAt(0.25) }}>End</p>
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm focus:border-brandCP/40 focus:outline-none focus:shadow-[0_0_0_1px_rgba(10,247,193,0.15)]"
                  style={{ color: 'var(--foreground)', colorScheme: 'auto' }}
                />
              </div>
            </div>
          </Field>

          {/* ── CP Reward ── */}
          {/* Locked on edit: contributors are already racing against this pool. */}
          <Field icon={<Trophy className="h-3.5 w-3.5" />} label="CP Reward">
            <div className="flex items-center gap-4">
              {!isEdit && (
                <input
                  type="number"
                  min={0}
                  step={10}
                  value={cp}
                  onChange={e => setCp(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-28 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm focus:border-brandCP/40 focus:outline-none focus:shadow-[0_0_0_1px_rgba(10,247,193,0.15)]"
                  style={{ color: 'var(--foreground)' }}
                />
              )}
              <div className="flex items-baseline gap-1.5 animate-fade-up">
                <span className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>{cp.toLocaleString()}</span>
                <span className="text-sm font-semibold text-brandCP">CP</span>
              </div>
            </div>
          </Field>

          {/* ── Le flow : configuration et règles ── */}
          {SectionFields && <SectionFields state={flowState} onChange={patchFlowState} ctx={ctx} />}

          {/* ── Description ── */}
          <Field icon={<AlignLeft className="h-3.5 w-3.5" />} label="Description">
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What is this challenge about?"
              rows={3}
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm focus:border-brandCP/40 focus:outline-none focus:shadow-[0_0_0_1px_rgba(10,247,193,0.15)] resize-none leading-relaxed"
              style={{ color: 'var(--foreground)' }}
            />
          </Field>

          {/* ── Brief — Markdown, enregistré comme document `brief.md` ──
              Affiché à un contributeur connecté qui n'a pas encore rejoint le
              challenge, à la place des KPI et de l'espace de travail. En
              création il est bufferisé ici puis flushé. ── */}
          <div className="space-y-2">
            <button
              onClick={() => setShowBrief(v => !v)}
              className="flex items-center gap-1.5 text-xs transition-colors"
              style={{ color: fgAt(0.35) }}
            >
              <FileText className="h-3.5 w-3.5" />
              {showBrief ? 'Hide brief' : brief.trim() ? 'Edit brief' : 'Add brief (optional)'}
              <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${showBrief ? 'rotate-180' : ''}`} />
            </button>

            {showBrief && (
              <div className="space-y-2 animate-fade-up">
                <p className="text-xs" style={{ color: fgAt(0.3) }}>
                  Context, objectives and expected result, in Markdown. Shown before the workspace
                  to contributors who have not joined yet, and kept in the challenge documents as
                  <code className="mx-1 rounded bg-white/10 px-1 py-0.5 font-mono text-[11px]">brief.md</code>
                  afterwards.
                </p>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setBriefPreview(v => !v)}
                    disabled={!brief.trim()}
                    className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] transition-colors hover:border-white/20 disabled:opacity-40"
                    style={{ color: fgAt(0.45) }}
                  >
                    {briefPreview ? <Pencil className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    {briefPreview ? 'Write' : 'Preview'}
                  </button>
                  {!brief.trim() && (
                    <button
                      onClick={() => setBrief(BRIEF_TEMPLATE)}
                      className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] transition-colors hover:border-brandCP/30 hover:text-brandCP/70"
                      style={{ color: fgAt(0.45) }}
                    >
                      <Plus className="h-3 w-3" />
                      Start from the template
                    </button>
                  )}
                </div>

                {briefPreview ? (
                  <div className="max-h-96 overflow-y-auto rounded-xl border border-white/[0.07] bg-white/[0.02] px-5 py-4">
                    <Markdown source={brief} variant="prose" />
                  </div>
                ) : (
                  <textarea
                    value={brief}
                    onChange={e => setBrief(e.target.value)}
                    placeholder={'## Context\n\n…'}
                    rows={14}
                    className="w-full resize-y rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 font-mono text-xs leading-relaxed focus:border-brandCP/40 focus:outline-none focus:shadow-[0_0_0_1px_rgba(10,247,193,0.15)]"
                    style={{ color: 'var(--foreground)' }}
                  />
                )}
              </div>
            )}
          </div>

          {/* ── Le flow : éditeurs autonomes (tâches, cibles, dépôt…) ── */}
          {SectionDetails && <SectionDetails state={flowState} onChange={patchFlowState} ctx={ctx} />}

          {/* ── Slack discussion signals (edit only, every flow) — independent CRUD ── */}
          {isEdit && (
            <ChallengeSlackSignalsEditor challengeId={challenge!.uuid} open={open} />
          )}

          {/* ── Roadmap (optional) ── */}
          <div className="space-y-2">
            <button
              onClick={() => setShowRoadmap(v => !v)}
              className="flex items-center gap-1.5 text-xs transition-colors"
              style={{ color: fgAt(0.35) }}
            >
              <Map className="h-3.5 w-3.5" />
              {showRoadmap ? 'Hide roadmap' : 'Add roadmap (optional)'}
              <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${showRoadmap ? 'rotate-180' : ''}`} />
            </button>
            {showRoadmap && (
              <textarea
                value={roadmap}
                onChange={e => setRoadmap(e.target.value)}
                placeholder="Roadmap, milestones, links…"
                rows={4}
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm focus:border-brandCP/40 focus:outline-none focus:shadow-[0_0_0_1px_rgba(10,247,193,0.15)] resize-none leading-relaxed animate-fade-up"
                style={{ color: 'var(--foreground)' }}
              />
            )}
          </div>

          {/* Error */}
          {error && (
            <p className="rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-sm text-red-400 animate-slide-in">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-white/[0.07] px-6 py-4 flex items-center justify-between gap-4">
          <button
            onClick={onClose}
            className="text-sm transition-colors"
            style={{ color: fgAt(0.35) }}
          >
            Cancel
          </button>

          <button
            onClick={pendingChallenge ? handleAcknowledgeFailure : handleSubmit}
            disabled={saving || (success && !pendingChallenge)}
            className={`flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60
              ${success
                ? 'bg-green-500/20 text-green-400'
                : 'bg-brandCP/20 text-brandCP hover:bg-brandCP/30 hover:shadow-[0_0_16px_rgba(10,247,193,0.2)]'
              }`}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {success && <CheckCircle2 className="h-4 w-4" />}
            {pendingChallenge
              ? 'Continue'
              : isPromotion
                ? (success ? 'Promoted!' : saving ? 'Promoting…' : 'Promote to challenge')
                : isEdit
                  ? (success ? 'Saved!' : saving ? 'Saving…' : 'Save changes')
                  : (success ? 'Created!' : saving ? 'Creating…' : 'Create challenge')}
          </button>
        </div>
      </div>
    </>
  );
}
