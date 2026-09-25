'use client';

import { useState, useEffect } from 'react';
import { FormField, FormFooter, FormSection, inputClass, selectClass } from '@/components/ui/FormField';
import { ChallengeTasksEditor } from './ChallengeTasksEditor';
import { Code2, BrainCircuit, ShieldCheck, Cpu, Package, Eye, Pencil, Plus, Loader2 } from 'lucide-react';
import { Toggle } from '@/components/ui/Toggle';
import { SlugField } from '@/components/ui/SlugField';
import { Markdown } from '@/components/ui/Markdown';
import { CoverImageField } from './CoverImageField';
import { useSlugField } from '@/lib/useSlugField';
import { BRIEF_TEMPLATE, findBrief } from '@/lib/challengeBrief';
import { flushBrief } from './briefFlush';
import { MlRewardRulesEditor } from './MlRewardRulesEditor';
import { ValidationTargetsEditor } from './ValidationTargetsEditor';
import { ValidationRewardsPanel } from './ValidationRewardsPanel';
import { DEFAULT_ML_REWARD_RULES, parseMlRewardRules, type MlRewardRules } from '../../../../../packages/database-service/domain/mlRewardRules';
import type { Challenge, Project } from '../../../../../packages/database-service/domain/entities';

interface ChallengeFormProps {
  challenge?: Challenge;
  projects: Project[];
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

export function ChallengeForm({ challenge, projects, onSubmit, onCancel }: ChallengeFormProps) {
  const [formData, setFormData] = useState({
    title: challenge?.title ?? '',
    status: challenge?.status ?? 'draft',
    type: (challenge as any)?.type ?? 'code',
    start_date: challenge?.start_date ? new Date(challenge.start_date).toISOString().split('T')[0] : '',
    end_date: challenge?.end_date ? new Date(challenge.end_date).toISOString().split('T')[0] : '',
    description: challenge?.description ?? '',
    roadmap: challenge?.roadmap ?? '',
    contribution_points_reward: challenge?.contribution_points_reward ?? 0,
    project_id: challenge?.project_id ?? '',
  });

  const slugField = useSlugField('challenge', formData.title);
  const { reset: resetSlug } = slugField;
  // En édition, le slug enregistré : le titre n'y touche plus. Déclaré après le
  // hook, donc appliqué après sa dérivation depuis le titre initial.
  useEffect(() => {
    if (challenge) {
      resetSlug({ title: challenge.title, value: challenge.slug, saved: challenge.slug, excludeId: challenge.uuid });
    }
  }, [challenge, resetSlug]);

  const [rewardRules, setRewardRules] = useState<MlRewardRules>(
    parseMlRewardRules(challenge?.reward_rules) ?? DEFAULT_ML_REWARD_RULES
  );
  const [computeEnabled, setComputeEnabled] = useState((challenge as any)?.compute_enabled ?? false);
  const [apiPackagingEnabled, setApiPackagingEnabled] = useState(true);

  // Couverture — l'image de la carte du listing et de l'en-tête publique.
  // Vide = effacée : `null` est une valeur, l'absence n'en est pas une, et
  // l'API laisse en place un champ absent.
  const [coverImageUrl, setCoverImageUrl] = useState(challenge?.cover_image_url ?? '');

  // L'hôte — qui porte le challenge, en une phrase, rendue telle quelle sur la
  // page publique. Même règle que la couverture : vide, la carte disparaît.
  const [host, setHost] = useState(challenge?.host ?? '');

  // Avancement — stocké en ratio 0–1, saisi en pourcentage : c'est ce que
  // lisent les cartes publiques, et personne ne raisonne en 0,42.
  const [completionPct, setCompletionPct] = useState(
    String(Math.round((challenge?.completion ?? 0) * 100))
  );

  // Brief — le document `brief.md` du challenge, affiché à un contributeur
  // connecté qui n'a pas encore rejoint. Il vit dans les documents, pas dans
  // la ligne : en édition il faut aller le chercher. `existingBriefId` sert au
  // cas « brief vidé » — sans lui, impossible de supprimer le document, et la
  // page continuerait d'afficher l'ancien texte.
  const [brief, setBrief] = useState('');
  const [existingBriefId, setExistingBriefId] = useState<string | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefPreview, setBriefPreview] = useState(false);
  const [briefError, setBriefError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const id = challenge?.uuid;
    if (!id) {
      setBrief('');
      setExistingBriefId(null);
      return;
    }
    let cancelled = false;
    setBriefLoading(true);
    fetch(`/api/challenges/${id}/documents`)
      .then(r => (r.ok ? r.json() : []))
      .then((docs: { uuid: string; filename: string; content: string }[]) => {
        if (cancelled) return;
        const found = findBrief(Array.isArray(docs) ? docs : []);
        setBrief(found?.content ?? '');
        setExistingBriefId(found?.uuid ?? null);
      })
      // Silencieux : le reste du formulaire reste utilisable, le brief
      // s'affiche simplement vide.
      .catch(() => {})
      .finally(() => { if (!cancelled) setBriefLoading(false); });
    return () => { cancelled = true; };
  }, [challenge?.uuid]);

  const [sourceChallengeId, setSourceChallengeId] = useState((challenge as any)?.source_challenge_id ?? '');
  const [cpPerValidation, setCpPerValidation] = useState((challenge as any)?.cp_per_validation ?? 5);
  const [requiredValidations, setRequiredValidations] = useState((challenge as any)?.required_validations ?? 3);
  const [sourceChallenges, setSourceChallenges] = useState<{ id: string; title: string; type: string }[]>([]);

  // Only needed to populate the source-challenge picker when creating a new
  // validation challenge — editing never touches this field (locked).
  useEffect(() => {
    // Sert seulement au sélecteur de challenge source d'un challenge de
    // validation — inaccessible en édition. `ml` et `code` sont tous deux
    // adossables : le type retenu décide du mode (cas de référence vs
    // scénario), qui n'est jamais stocké.
    if (challenge?.uuid) return;
    fetch('/api/challenges')
      .then(res => res.ok ? res.json() : [])
      .then((all: any[]) => setSourceChallenges(
        (Array.isArray(all) ? all : [])
          .filter(c => c.type === 'ml' || c.type === 'code')
          .map(c => ({ id: c.uuid, title: c.title, type: c.type }))
      ))
      .catch(() => {});
  }, [challenge?.uuid]);

  // En création, le mode se lit sur le type du challenge source sélectionné.
  // En édition la liste des sources n'est jamais chargée (fetch sauté ci-
  // dessus), mais `required_validations` porte la même information : l'API
  // la force à null pour une source `code`, où rien ne se résout et où il
  // n'y a pas de quorum. `== null` couvre aussi `undefined` — un strict
  // `===` manquerait un challenge dont le champ est simplement absent.
  const sourceChallenge = sourceChallenges.find(c => c.id === sourceChallengeId);
  const isScenarioMode = challenge?.uuid
    ? challenge?.required_validations == null
    : sourceChallenge?.type === 'code';

  /** Le ratio 0–1 attendu par l'API, depuis le pourcentage saisi. */
  const completionValue = Math.min(1, Math.max(0, (parseFloat(completionPct) || 0) / 100));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Le champ affiche déjà pourquoi : pris, invalide, ou vérification en cours.
    if (!slugField.ready) return;

    // Le brief a sa propre route — c'est un document, pas une colonne — et ne
    // se sauvegarde qu'en édition : en création le challenge n'a pas encore
    // d'uuid à qui l'attacher. On le flushe avant d'envoyer le reste : en
    // échec, rien n'est soumis et le texte saisi reste à l'écran.
    setBriefError('');
    if (challenge?.uuid && (brief.trim() || existingBriefId)) {
      setSaving(true);
      const { ok } = await flushBrief(challenge.uuid, brief, existingBriefId);
      if (!ok) {
        setSaving(false);
        setBriefError('The brief could not be saved - nothing else was submitted, your text is still here.');
        return;
      }
      // Le document vient d'être créé ou supprimé : sans relire son id, un
      // second envoi dans la même session ne saurait plus quoi supprimer.
      if (!brief.trim()) {
        setExistingBriefId(null);
      } else if (!existingBriefId) {
        const docs = await fetch(`/api/challenges/${challenge.uuid}/documents`)
          .then(r => (r.ok ? r.json() : []))
          .catch(() => []);
        setExistingBriefId(findBrief(Array.isArray(docs) ? docs : [])?.uuid ?? null);
      }
      setSaving(false);
    }

    // Reward rules only apply to ML challenges. For other types we omit the
    // key entirely (PUT treats an absent field as "unchanged") instead of
    // sending null, which would wipe out a code challenge's real rules.
    // source_challenge_id / cp_per_validation are creation-only (locked after,
    // like the pool/project) — only sent when creating a new challenge.
    onSubmit({
      ...formData,
      // En édition, seulement s'il a changé : l'ancien devient une redirection.
      ...(!challenge?.uuid || slugField.changed ? { slug: slugField.submitValue } : {}),
      // Édition seulement : à la création il n'y a rien de fait, la colonne
      // part à 0 et le POST n'a pas à s'en occuper.
      ...(challenge?.uuid ? { completion: completionValue } : {}),
      cover_image_url: coverImageUrl.trim() || null,
      host: host.trim() || null,
      ...(formData.type === 'ml' ? { reward_rules: rewardRules } : {}),
      compute_enabled: formData.type === 'ml' ? computeEnabled : false,
      ...(formData.type === 'validation' && !challenge?.uuid
        ? {
            source_challenge_id: sourceChallengeId,
            cp_per_validation: cpPerValidation,
            ...(isScenarioMode ? {} : { required_validations: requiredValidations }),
          }
        : {}),
      ...(formData.type === 'ml' && !challenge?.uuid
        ? { api_packaging_enabled: apiPackagingEnabled }
        : {}),
    });
  };

  const set = (field: keyof typeof formData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setFormData((p) => ({
        ...p,
        [field]: field === 'contribution_points_reward' ? parseInt(e.target.value) || 0 : e.target.value,
      }));

  return (
    <form onSubmit={handleSubmit} className="space-y-6 p-4">
      {/* Section: Identité */}
      <FormSection title="General">
        <FormField label="Title" required>
          <input
            type="text"
            required
            value={formData.title}
            onChange={set('title')}
            className={inputClass}
            placeholder="Challenge title"
            autoFocus
          />
        </FormField>

        <FormField label="Address" required>
          <SlugField field={slugField} />
        </FormField>

        {/* Type picker */}
        <FormField label="Type">
          <div className="flex gap-2">
            {([
              { value: 'code',       label: 'Code',       icon: Code2,        desc: 'Tasks, Kanban, GitHub' },
              { value: 'ml',         label: 'ML',         icon: BrainCircuit, desc: 'Dataset, Model, API' },
              { value: 'validation', label: 'Validation', icon: ShieldCheck,  desc: 'Test a submitted API live' },
            ] as const).map(opt => {
              const Icon = opt.icon;
              const active = formData.type === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFormData(p => ({ ...p, type: opt.value }))}
                  className={`flex flex-1 items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all duration-200 ${
                    active
                      ? 'border-brandCP/40 bg-brandCP/10 ring-1 ring-brandCP/20'
                      : 'border-white/[0.06] bg-white/[0.02] hover:border-white/15'
                  }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-brandCP' : 'text-white/30'}`} />
                  <div>
                    <p className={`text-sm font-semibold ${active ? 'text-white' : 'text-white/50'}`}>{opt.label}</p>
                    <p className="text-[10px] text-white/30">{opt.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </FormField>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Status" required>
            <select required value={formData.status} onChange={set('status')} className={selectClass}>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </select>
          </FormField>

          <FormField label="Project" required>
            <select required value={formData.project_id} onChange={set('project_id')} className={selectClass}>
              <option value="">Select a project</option>
              {projects.map((p) => (
                <option key={p.uuid} value={p.uuid}>{p.title}</option>
              ))}
            </select>
          </FormField>

          <FormField label="CP Reward" required>
            <input
              type="number"
              required
              min={0}
              value={formData.contribution_points_reward}
              onChange={set('contribution_points_reward')}
              className={inputClass}
              placeholder="0"
            />
          </FormField>
        </div>

        {formData.type === 'ml' && (
          <MlRewardRulesEditor
            value={rewardRules}
            pool={formData.contribution_points_reward}
            onChange={setRewardRules}
          />
        )}

        {formData.type === 'ml' && (
          <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3.5">
            <div className="flex items-center gap-3 min-w-0">
              <Cpu className="h-4 w-4 text-white/50" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-white">GPU compute power</p>
                <p className="text-xs text-white/35 mt-0.5">Lets contributors request a Scaleway instance on this challenge</p>
              </div>
            </div>
            <Toggle enabled={computeEnabled} onChange={setComputeEnabled} />
          </div>
        )}

        {formData.type === 'ml' && !challenge?.uuid && (
          <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3.5">
            <div className="flex items-center gap-3 min-w-0">
              <Package className="h-4 w-4 text-white/50" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-white">API Packaging step</p>
                <p className="text-xs text-white/35 mt-0.5">Adds a 3rd API Packaging step on top of Dataset and Model</p>
              </div>
            </div>
            <Toggle enabled={apiPackagingEnabled} onChange={setApiPackagingEnabled} />
          </div>
        )}

        {formData.type === 'validation' && (
          <FormField label="Source challenge" required>
            {challenge?.uuid ? (
              <p className="text-sm" style={{ color: 'var(--foreground)' }}>
                {sourceChallenges.find(c => c.id === sourceChallengeId)?.title ?? 'Source challenge (locked)'}
              </p>
            ) : (
              <>
                <select
                  required
                  value={sourceChallengeId}
                  onChange={e => setSourceChallengeId(e.target.value)}
                  className={selectClass}
                >
                  <option value="">Select a source challenge</option>
                  {sourceChallenges.map(c => (
                    <option key={c.id} value={c.id}>{c.title} · {c.type === 'ml' ? 'ML' : 'Code'}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  {isScenarioMode
                    ? 'A Code challenge: validators walk a scenario through each deployed application.'
                    : 'An ML challenge: validators test each endpoint against a ground-truth reference case.'}
                </p>
              </>
            )}
          </FormField>
        )}

        {formData.type === 'validation' && (
          <FormField label="CP per validation" required>
            {challenge?.uuid ? (
              <p className="text-sm" style={{ color: 'var(--foreground)' }}>{cpPerValidation} CP</p>
            ) : (
              <input
                type="number"
                required
                min={1}
                value={cpPerValidation}
                onChange={e => setCpPerValidation(Math.max(1, parseInt(e.target.value) || 1))}
                className={inputClass}
              />
            )}
          </FormField>
        )}

        {formData.type === 'validation' && !isScenarioMode && (
          <FormField label="Required validations" required>
            {challenge?.uuid ? (
              <p className="text-sm" style={{ color: 'var(--foreground)' }}>{requiredValidations} validators must agree</p>
            ) : (
              <>
                <input
                  type="number"
                  required
                  min={1}
                  step={2}
                  value={requiredValidations}
                  onChange={e => {
                    const n = parseInt(e.target.value) || 1;
                    setRequiredValidations(n % 2 === 0 ? n + 1 : n);
                  }}
                  className={inputClass}
                />
                <p className="mt-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  Must be odd - a target resolves once this many validators have voted, majority wins.
                </p>
              </>
            )}
          </FormField>
        )}

        <FormField label="Description">
          <textarea
            rows={3}
            value={formData.description}
            onChange={set('description')}
            className={inputClass}
            placeholder="What is this challenge about?"
          />
        </FormField>

        <FormField label="Cover image" hint="Carried by the listing card and the public challenge header. Emptying it removes the image.">
          <CoverImageField value={coverImageUrl} onChange={setCoverImageUrl} />
        </FormField>

        <FormField
          label="Host"
          hint="Who runs this challenge - the clinical partner, the Lab team. Rendered as is on the public page; emptying it removes the card."
        >
          <input
            type="text"
            value={host}
            onChange={e => setHost(e.target.value)}
            maxLength={500}
            className={inputClass}
            placeholder="CHU de Montpellier, service de médecine physique et de réadaptation"
          />
        </FormField>
      </FormSection>

      {/* Section: Planning */}
      <FormSection title="Planning">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Start Date">
            <input
              type="date"
              value={formData.start_date}
              onChange={set('start_date')}
              className={inputClass}
            />
          </FormField>

          <FormField label="End Date">
            <input
              type="date"
              value={formData.end_date}
              onChange={set('end_date')}
              className={inputClass}
            />
          </FormField>
        </div>

        {/* Avancement — édition seulement : un challenge naît à 0. */}
        {challenge?.uuid && (
          <FormField
            label="Completion"
            hint={
              formData.type === 'ml'
                ? 'Shown on the public cards. Rewritten automatically each time ML rewards are distributed.'
                : 'Shown on the public cards. Nothing computes it for this type - it is what you set here.'
            }
          >
            <div className="flex items-center gap-4">
              <div className="flex w-32 shrink-0 items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={completionPct}
                  onChange={e => setCompletionPct(e.target.value)}
                  className={inputClass}
                />
                <span className="text-sm text-white/40">%</span>
              </div>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full bg-brandCP/60 transition-[width] duration-500"
                  style={{ width: `${Math.round(completionValue * 100)}%` }}
                />
              </div>
            </div>
          </FormField>
        )}

        <FormField label="Roadmap">
          <textarea
            rows={4}
            value={formData.roadmap}
            onChange={set('roadmap')}
            className={inputClass}
            placeholder="Roadmap, milestones, objectives…"
          />
        </FormField>
      </FormSection>

      {/* Section: Brief — le document `brief.md`, édition seulement (en
          création le challenge n'a pas encore d'uuid à qui l'attacher) */}
      {challenge?.uuid && (
        <FormSection title="Brief">
          <p className="text-xs text-white/25">
            Context, objectives and expected result, in Markdown. Shown before the workspace to
            contributors who have not joined yet, and kept in the challenge documents as
            <code className="mx-1 rounded bg-white/10 px-1 py-0.5 font-mono text-[11px]">brief.md</code>
            afterwards. Emptying it deletes the document.
          </p>

          {briefLoading ? (
            <p className="flex items-center gap-2 text-xs text-white/30">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading the brief…
            </p>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setBriefPreview(v => !v)}
                  disabled={!brief.trim()}
                  className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] text-white/45 transition-colors hover:border-white/20 disabled:opacity-40"
                >
                  {briefPreview ? <Pencil className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  {briefPreview ? 'Write' : 'Preview'}
                </button>
                {!brief.trim() && (
                  <button
                    type="button"
                    onClick={() => setBrief(BRIEF_TEMPLATE)}
                    className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] text-white/45 transition-colors hover:border-brandCP/30 hover:text-brandCP/70"
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
                  className="w-full resize-y rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 font-mono text-xs leading-relaxed text-white placeholder:text-white/20 transition-colors focus:border-brandCP/40 focus:outline-none focus:shadow-[0_0_0_1px_rgba(10,247,193,0.15)]"
                />
              )}

              {briefError && (
                <p className="rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-sm text-red-400">
                  {briefError}
                </p>
              )}
            </>
          )}
        </FormSection>
      )}

      {/* Section: Validation targets — edit only */}
      {challenge?.uuid && formData.type === 'validation' && (
        <FormSection title="Validation targets">
          <ValidationTargetsEditor challengeId={challenge.uuid} open />
          <div className="mt-3">
            <ValidationRewardsPanel challengeId={challenge.uuid} open />
          </div>
        </FormSection>
      )}

      {/* Section: Tasks — seulement en mode édition */}
      {challenge?.uuid && (
        <FormSection title="Tasks">
          <ChallengeTasksEditor challengeId={challenge.uuid} open />
        </FormSection>
      )}

      <FormFooter
        onCancel={onCancel}
        submitLabel={challenge ? 'Update Challenge' : 'Create Challenge'}
        loading={saving}
      />
    </form>
  );
}
