import type { ComponentType, CSSProperties } from 'react';

/**
 * Sections de formulaire par flow (challenge 020, L4c)
 * ----------------------------------------------------
 * Le tiroir de création et d'édition d'un challenge porte les champs communs
 * (titre, adresse, projet, statut, dates, pool, description, brief, roadmap).
 * Tout ce qui dépend du flow — ses champs de configuration, ses règles, ses
 * éditeurs autonomes, ce qu'il ajoute au corps envoyé et ce qu'il enregistre
 * après coup — vient de sa section, déclarée par la distribution
 * (`src/distribution/mytwin.forms.tsx`). Le tiroir ne connaît aucun flow.
 */

/** An existing challenge being edited, as returned by GET /api/challenges/:id. */
export interface EditableChallenge {
  uuid: string;
  title: string;
  slug: string;
  status: string;
  type: string;
  start_date?: string | Date | null;
  end_date?: string | Date | null;
  description?: string | null;
  roadmap?: string | null;
  contribution_points_reward: number;
  project_id: string;
  /** Lues par la section du flow, qui sait les parser. */
  reward_rules?: unknown;
  source_challenge_id?: string | null;
  flow_config?: unknown;
}

/**
 * La proposition dont le tiroir fait un challenge. Réduite à ce qui pré-remplit
 * le formulaire — le reste (auteur, stars, dépôt) est déjà décidé côté serveur.
 */
export interface PromotableSandbox {
  uuid: string;
  title: string;
  /** Proposé tel quel comme slug du challenge : les deux espaces de noms sont séparés. */
  slug: string;
  /** La clé du flow hérité, jamais choisie : le sélecteur est verrouillé. */
  type: string;
  context?: string | null;
  goals: string[];
  why?: string | null;
}

/** Le challenge créé, promu ou enregistré : `uuid` pour les URLs admin, `slug` pour les pages publiques. */
export interface SavedChallenge {
  uuid: string;
  slug: string;
}

export type FlowFormMode = 'create' | 'edit' | 'promotion';

export interface FlowFormContext {
  mode: FlowFormMode;
  /** Présent en édition. */
  challenge?: EditableChallenge;
  /** Présente en promotion. */
  promotion?: PromotableSandbox;
  /** Le pool saisi, contre lequel les éditeurs de règles simulent la distribution. */
  pool: number;
  /** Le tiroir est ouvert : les éditeurs autonomes chargent à l'ouverture. */
  open: boolean;
}

/** Ce qu'une section fait, sans interface : testable hors navigateur. */
export interface FlowFormLogic<State = any> {
  /** L'entrée du sélecteur de type. Une entrée peut couvrir plusieurs flows. */
  key: string;
  /** L'entrée affichée pour un challenge existant de ce flow. */
  covers(flowKey: string | null | undefined): boolean;
  initialState(ctx: FlowFormContext): State;
  /** Le message qui bloque l'envoi, ou `null`. */
  validate?(state: State, ctx: FlowFormContext): string | null;
  /**
   * Les champs du flow, fusionnés au corps commun. À la création, `type` est
   * posé ici : c'est la section qui sait quel flow elle crée.
   */
  body(state: State, ctx: FlowFormContext): Record<string, unknown>;
  /** Ce qui s'enregistre une fois le challenge créé. Rend les problèmes à afficher. */
  afterSave?(saved: SavedChallenge, state: State, ctx: FlowFormContext): Promise<string[]>;
}

export interface FlowFormSectionProps<State = any> {
  state: State;
  onChange(patch: Partial<State>): void;
  ctx: FlowFormContext;
}

export interface FlowFormSection<State = any> extends FlowFormLogic<State> {
  label: string;
  description: string;
  icon: ComponentType<{ className?: string; style?: CSSProperties }>;
  /** Sous le pool : configuration et règles. */
  Fields?: ComponentType<FlowFormSectionProps<State>>;
  /** Sous le brief : éditeurs autonomes (tâches, cibles…). */
  Details?: ComponentType<FlowFormSectionProps<State>>;
}
