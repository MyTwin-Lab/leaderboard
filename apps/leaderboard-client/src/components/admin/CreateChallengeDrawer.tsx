'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Trophy, CalendarDays, AlignLeft, Map, Loader2,
  CheckCircle2, ChevronDown, Plus, Pencil, FileText, Eye, Rocket, Image as ImageIcon, Building2, Percent, FolderKanban,
} from 'lucide-react';
import { Drawer } from '@/components/vitrine/Drawer';
import { SelectDropdown } from '@/components/ui/SelectDropdown';
import { ChallengeSlackSignalsEditor } from '@/components/admin/ChallengeSlackSignalsEditor';
import { flushBrief } from './briefFlush';
import { buildPromotionRequestBody } from './promotionRequestBody';
import { CoverImageField } from '@/components/admin/CoverImageField';
import { Field, LockedValue } from './challengeFormFields';
import { buildPromotedBrief, buildPromotedDescription } from '../../../../../packages/services/sandbox/promotion';
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

// Les classes `.v-md-*` de l'aperçu du brief vivent dans la feuille de la page
// vitrine d'un challenge ; `challenge-drawer-vitrine.css` les ramène à
// l'échelle du panneau.
import '@/components/challenges/vitrine/challenge-vitrine.css';
import './challenge-drawer-vitrine.css';

export type { EditableChallenge, PromotableSandbox, SavedChallenge } from '@/lib/flowFormSlots';

/** Les formes qu'une proposition peut prendre : code ou ML (clés de section). */
const PROMOTABLE_SECTION_KEYS = new Set(['code', 'ml']);

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
   * Présente = mode promotion, **exclusif** de `challenge`. Le tiroir crée le
   * projet de la proposition et son premier challenge : titre, adresse,
   * description et brief sont pré-remplis depuis la proposition, le projet
   * n'est pas à choisir (il naît avec le challenge, managé par l'auteur), et
   * le formulaire poste vers `/api/sandboxes/:id/promote` au lieu de
   * `/api/challenges`.
   */
  promotion?: PromotableSandbox;
}

/** Date inputs need YYYY-MM-DD; the API hands back ISO strings or Dates. */
const toDateInput = (d: string | Date | null | undefined): string =>
  d ? new Date(d).toISOString().split('T')[0] : '';

/** Les statuts, avec la couleur de leur pastille (`--v-dot` de `.v-status-dot`). */
const STATUS_OPTIONS = [
  { value: 'draft',     label: 'Draft',     dot: 'var(--v-subtle)'     },
  { value: 'active',    label: 'Active',    dot: 'var(--v-accent)'     },
  { value: 'completed', label: 'Completed', dot: '#1d4ed8'             },
  { value: 'archived',  label: 'Archived',  dot: 'rgb(17 22 26 / 0.3)' },
];

/**
 * Le tiroir de challenge — création, édition et promotion d'un sandbox.
 *
 * Il porte les champs communs à tout challenge. Ce qui dépend du flow (sa
 * configuration, ses règles, ses éditeurs, ce qu'il ajoute au corps envoyé et
 * ce qu'il enregistre après coup) vient de la section du flow choisi, déclarée
 * par la distribution (`src/distribution/mytwin.forms.tsx`).
 *
 * Sa coque est le `Drawer` du design vitrine ; ses champs, le vocabulaire
 * commun de `forms-vitrine.css`.
 */
export function CreateChallengeDrawer({ open, onClose, projects, onCreated, challenge, promotion }: CreateChallengeDrawerProps) {
  const isEdit = !!challenge;
  const isPromotion = !!promotion;
  const mode: FlowFormMode = isPromotion ? 'promotion' : isEdit ? 'edit' : 'create';
  // Le type décide des repos créés, et ils ne le sont qu'une fois : verrouillé
  // en édition parce qu'ils existent déjà. En promotion, c'est ici que la forme
  // du challenge se choisit — un sandbox est une idée et ne porte pas de type ;
  // `code` / `ml` décide des repos à créer et de la grille.
  const typeLocked = isEdit;

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
  // La complétion, en pourcentage entier (la colonne est un ratio 0–1). Édition
  // seulement : un challenge naît à 0. `initialCompletion` sert à ne l'envoyer
  // que si l'admin y a touché — pour un code ou un ML, une distribution de
  // rewards peut l'avoir recalculée pendant que le tiroir était ouvert, et
  // renvoyer la valeur d'ouverture l'écraserait.
  const [completion, setCompletion] = useState(0);
  const [initialCompletion, setInitialCompletion] = useState(0);
  const [description, setDescription] = useState('');
  const [roadmap, setRoadmap] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [host, setHost] = useState('');
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
      const pct = Math.round((challenge.completion ?? 0) * 100);
      setCompletion(pct);
      setInitialCompletion(pct);
      setDescription(challenge.description ?? '');
      setRoadmap(challenge.roadmap ?? '');
      setCoverImageUrl(challenge.cover_image_url ?? '');
      setHost(challenge.host ?? '');
      setShowRoadmap(!!challenge.roadmap);
      const edited = formSectionFor(challenge.type);
      setSectionKey(edited.key);
      setFlowStates({ [edited.key]: edited.initialState({ mode: 'edit', challenge, pool: challenge.contribution_points_reward, open }) });
    } else if (promotion) {
      setTitle(promotion.title);
      // Les espaces de noms sont séparés : `/sandbox/mykine` peut devenir
      // `/challenges/mykine`. La vérification dira s'il est déjà pris.
      slugField.reset({ title: promotion.title, value: promotion.slug });
      // `code` n'est qu'un point de départ, la forme la plus courante : le
      // sélecteur reste ouvert, et chaque section repart de la proposition.
      const promoted = creatableFormSections[0];
      setSectionKey(promoted.key);
      setFlowStates({ [promoted.key]: promoted.initialState({ mode: 'promotion', promotion, pool: cp, open }) });
      // L'accroche et le brief sont composés par les mêmes fonctions que le
      // serveur, pour que ce que l'admin relit soit exactement ce qui serait
      // écrit s'il n'y touchait pas. Les trois sections de la proposition
      // deviennent le brief, ouvert d'emblée : c'est ce qu'il y a à relire.
      setDescription(buildPromotedDescription({ context: promotion.context ?? null }));
      setBrief(buildPromotedBrief({
        context: promotion.context ?? null,
        goals: promotion.goals ?? [],
        why: promotion.why ?? null,
      }));
      setExistingBriefId(null);
      setShowBrief(true);
      // Promouvoir, c'est ouvrir le challenge — pas préparer un brouillon.
      setStatus('active');
      // Pas de projet à choisir : la promotion crée le sien.
      setProjectId('');
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
    setCompletion(0);
    setInitialCompletion(0);
    setDescription('');
    setRoadmap('');
    setCoverImageUrl('');
    setHost('');
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
    // En promotion le projet n'est pas à choisir : il naît avec le challenge.
    if (!title.trim() || (!isPromotion && !projectId)) {
      setError(isPromotion ? 'Title is required.' : 'Title and project are required.');
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
        // Vide = effacé : la carte du listing retombe sur la banque locale, et
        // la carte « Who hosts this challenge » disparaît de la page publique.
        cover_image_url: coverImageUrl.trim() || null,
        host: host.trim() || null,
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
                  {
                    title,
                    slug: slugField.submitValue,
                    status,
                    // La section choisie dit la forme du challenge ; seules code et ML se promeuvent.
                    type: section.key === 'ml' ? 'ml' : 'code',
                    startDate,
                    endDate,
                    description,
                    roadmap,
                    // Le brief part avec le corps : la promotion l'écrit dans
                    // sa transaction, il n'y a pas de flush après coup.
                    brief,
                    cp,
                  },
                  flowFields,
                )
              : isEdit
                // Envoyés seulement s'ils ont changé : l'ancien slug devient une
                // redirection, et la complétion ne doit pas écraser un recalcul.
                ? {
                    ...shared,
                    ...flowFields,
                    ...(slugField.changed ? { slug: slugField.submitValue } : {}),
                    ...(completion !== initialCompletion ? { completion: completion / 100 } : {}),
                  }
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
        // création), même traitement de l'échec. Sauf en promotion, où il est
        // parti dans le corps et écrit par la transaction.
        if (!isPromotion && saved.uuid && (brief.trim() || existingBriefId)) {
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

  const footer = (
    <>
      <button type="button" onClick={onClose} className="v-btn-text">
        Cancel
      </button>

      <button
        type="button"
        onClick={pendingChallenge ? handleAcknowledgeFailure : handleSubmit}
        disabled={saving || (success && !pendingChallenge)}
        className="v-btn v-cdr-submit"
        data-tone={isPromotion && !success ? 'accent' : undefined}
        data-state={success ? 'success' : undefined}
      >
        {saving && <Loader2 className="v-spin" />}
        {success && <CheckCircle2 />}
        {pendingChallenge
          ? 'Continue'
          : isPromotion
            ? (success ? 'Promoted!' : saving ? 'Promoting…' : 'Promote to challenge')
            : isEdit
              ? (success ? 'Saved!' : saving ? 'Saving…' : 'Save changes')
              : (success ? 'Created!' : saving ? 'Creating…' : 'Create challenge')}
      </button>
    </>
  );

  return (
    <Drawer
      open={open}
      onClose={onClose}
      size="lg"
      className="v-cdr"
      icon={isPromotion ? <Rocket /> : isEdit ? <Pencil /> : <Plus />}
      title={isPromotion ? 'Promote to challenge' : isEdit ? 'Edit challenge' : 'New challenge'}
      footer={footer}
    >
      {/* ── Effets de la promotion ──
          Dit une fois, en tête : promouvoir n'est pas « créer un challenge
          de plus », c'est une opération qui touche la proposition, son
          auteur et le pool. L'admin doit le lire avant de valider. */}
      {isPromotion && (
        <div className="v-note">
          <p className="v-note-title">
            <Rocket />
            What promoting does
          </p>
          <ul>
            <li>Creates a <strong>new project</strong> named after the proposal, with its author as manager, and this challenge as its first one.</li>
            <li>Closes the sandbox as <strong>Promoted</strong> - for good.</li>
            <li>The proposal's context, goals and why become the challenge <strong>brief</strong>, pre-filled below for you to edit.</li>
            <li>The author joins as a member; they declare their workspace from the challenge, like everyone else.</li>
            <li>The promotion bonus is paid to the author, per the Sandbox module settings.</li>
            <li>The type is your call, below - it decides the steps and the grid. The cover image follows the proposal.</li>
          </ul>
        </div>
      )}

      {/* ── Title ── */}
      <div className="v-cdr-title">
        <input
          ref={titleRef}
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Challenge title…"
          className="v-bare"
        />
        <span className="v-cdr-title-line" />
      </div>

      {/* ── Address ── */}
      <Field label="Address">
        <SlugField field={slugField} />
      </Field>

      {/* ── Type ── */}
      {/* Locked on edit: the type decides which repos are created, and they
          only get created once, at creation. On promotion it is open: a
          sandbox is an idea and carries no type, so this is where the shape
          of the challenge gets decided — among the shapes a proposal can
          become, code or ML. */}
      <Field label="Type">
        <div className="v-choices">
          {creatableFormSections.map(opt => {
            const Icon = opt.icon;
            const active = section.key === opt.key;
            if (typeLocked && !active) return null;
            // Une validation dérive d'un challenge existant, une annotation
            // d'une campagne : aucune ne naît d'une proposition.
            if (isPromotion && !PROMOTABLE_SECTION_KEYS.has(opt.key)) return null;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => !typeLocked && setSectionKey(opt.key)}
                disabled={typeLocked}
                className="v-choice"
                data-on={active ? 'true' : 'false'}
                data-locked={typeLocked ? 'true' : 'false'}
              >
                <Icon />
                <div className="v-choice-text">
                  <p className="v-choice-name">{opt.label}</p>
                  <p className="v-choice-hint">{opt.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </Field>

      {/* ── Project ──
          En promotion il n'y a rien à choisir : le projet naît avec le
          challenge, nommé comme la proposition, son auteur pour manager. */}
      <Field icon={<FolderKanban />} label="Project">
        {isPromotion ? (
          <LockedValue text={`New project: ${title.trim() || promotion!.title} (managed by the author)`} />
        ) : isEdit ? (
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
              type="button"
              onClick={() => setStatus(opt.value)}
              className="v-status"
              data-on={status === opt.value ? 'true' : 'false'}
            >
              <span className="v-status-dot" style={{ '--v-dot': opt.dot } as React.CSSProperties} />
              {opt.label}
            </button>
          ))}
        </div>
      </Field>

      {/* ── Dates ── */}
      <Field icon={<CalendarDays />} label="Timeline">
        <div className="flex items-center gap-3">
          <div className="v-field flex-1">
            <p className="v-label">Start</p>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              style={{ colorScheme: 'light' }}
            />
          </div>
          <span className="v-cdr-arrow">→</span>
          <div className="v-field flex-1">
            <p className="v-label">End</p>
            <input
              type="date"
              value={endDate}
              min={startDate}
              onChange={e => setEndDate(e.target.value)}
              style={{ colorScheme: 'light' }}
            />
          </div>
        </div>
      </Field>

      {/* ── CP Reward ── */}
      {/* Locked on edit: contributors are already racing against this pool. */}
      <Field icon={<Trophy />} label="CP Reward">
        <div className="flex items-center gap-4">
          {!isEdit && (
            <input
              type="number"
              min={0}
              step={10}
              value={cp}
              onChange={e => setCp(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-28"
            />
          )}
          <div className="v-figure animate-fade-up">
            <span className="v-figure-value">{cp.toLocaleString()}</span>
            <span className="v-figure-unit">CP</span>
          </div>
        </div>
      </Field>

      {/* ── Complétion (édition seulement) ──
          Le pourcentage que montrent les cartes et la barre de progression.
          Pour un code ou un ML, c'est la part du pool déjà versée, recalculée
          à chaque distribution : la saisir à la main sert surtout aux autres
          types, où rien ne la calcule. ── */}
      {isEdit && (
        <Field icon={<Percent />} label="Completion">
          <div className="flex items-center gap-4">
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              value={completion}
              onChange={e => setCompletion(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
              className="w-28"
            />
            <div className="flex-1 space-y-1.5">
              <div className="v-bar">
                <div className="v-bar-fill" style={{ width: `${completion}%` }} />
              </div>
              <p className="v-help" data-size="xs">
                {completion}% shown on the cards. Code and ML challenges recompute it at every reward
                distribution, from the share of the pool paid out.
              </p>
            </div>
          </div>
        </Field>
      )}

      {/* ── Le flow : configuration et règles ── */}
      {SectionFields && <SectionFields state={flowState} onChange={patchFlowState} ctx={ctx} />}

      {/* ── Couverture ──
          L'image que porteront la carte du listing et l'en-tête de la
          page du challenge. Posée à la création, modifiable ici. À la
          promotion, la couverture de la proposition suit d'elle-même. ── */}
      {!isPromotion && (
        <Field icon={<ImageIcon />} label="Cover image">
          <CoverImageField value={coverImageUrl} onChange={setCoverImageUrl} />
        </Field>
      )}

      {/* ── Hôte ──
          Qui porte le challenge : le partenaire clinique, l'équipe du Lab.
          Une phrase, rendue telle quelle sur la page publique ; vide, la
          carte « Who hosts this challenge » n'y apparaît pas. ── */}
      {!isPromotion && (
        <Field icon={<Building2 />} label="Host">
          <input
            type="text"
            value={host}
            onChange={e => setHost(e.target.value)}
            placeholder="CHU de Montpellier, service de médecine physique et de réadaptation"
            maxLength={500}
          />
        </Field>
      )}

      {/* ── Description ── */}
      <Field icon={<AlignLeft />} label="Description">
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="What is this challenge about?"
          rows={3}
        />
      </Field>

      {/* ── Brief — Markdown, enregistré comme document `brief.md` ──
          Affiché à un contributeur connecté qui n'a pas encore rejoint le
          challenge, à la place des KPI et de l'espace de travail. En
          création il est bufferisé ici puis flushé. ── */}
      <div className="v-field">
        <button
          type="button"
          onClick={() => setShowBrief(v => !v)}
          className="v-disclose"
          data-open={showBrief ? 'true' : 'false'}
        >
          <FileText />
          {showBrief ? 'Hide brief' : brief.trim() ? 'Edit brief' : 'Add brief (optional)'}
          <ChevronDown />
        </button>

        {showBrief && (
          <div className="v-field animate-fade-up">
            <p className="v-help" data-size="xs">
              {isPromotion
                ? 'Composed from the proposal: its context and why under Context, its goals as objectives. Add the expected result if you want one. '
                : 'Context, objectives and expected result, in Markdown. '}
              Shown before the workspace to contributors who have not joined yet, and kept in the
              challenge documents as <code className="v-code">brief.md</code> afterwards.
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setBriefPreview(v => !v)}
                disabled={!brief.trim()}
                className="v-btn-quiet v-btn-sm"
                data-on={briefPreview ? 'true' : 'false'}
              >
                {briefPreview ? <Pencil /> : <Eye />}
                {briefPreview ? 'Write' : 'Preview'}
              </button>
              {!brief.trim() && (
                <button
                  type="button"
                  onClick={() => setBrief(BRIEF_TEMPLATE)}
                  className="v-btn-text"
                  data-tone="accent"
                >
                  <Plus />
                  Start from the template
                </button>
              )}
            </div>

            {briefPreview ? (
              <div className="v-cdr-preview">
                <Markdown source={brief} variant="vitrine" />
              </div>
            ) : (
              <textarea
                value={brief}
                onChange={e => setBrief(e.target.value)}
                placeholder={'## Context\n\n…'}
                rows={14}
                data-mono="true"
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
      <div className="v-field">
        <button
          type="button"
          onClick={() => setShowRoadmap(v => !v)}
          className="v-disclose"
          data-open={showRoadmap ? 'true' : 'false'}
        >
          <Map />
          {showRoadmap ? 'Hide roadmap' : 'Add roadmap (optional)'}
          <ChevronDown />
        </button>
        {showRoadmap && (
          <textarea
            value={roadmap}
            onChange={e => setRoadmap(e.target.value)}
            placeholder="Roadmap, milestones, links…"
            rows={4}
            className="animate-fade-up"
          />
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="v-alert animate-slide-in">
          {error}
        </p>
      )}
    </Drawer>
  );
}
