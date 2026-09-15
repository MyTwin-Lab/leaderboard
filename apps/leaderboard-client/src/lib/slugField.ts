import {
  SLUG_FALLBACK,
  normalizeSlugInput,
  slugProblem,
  slugify,
} from '../../../../packages/database-service/domain/slug';

/**
 * L'état du champ slug des formulaires de création et d'édition — la partie
 * pure, testée sans React. `useSlugField` y branche le titre et la
 * vérification de disponibilité.
 *
 * Deux modes :
 * - `auto` : le slug suit le titre. C'est l'état d'une création tant que
 *   personne n'a touché au champ. Un slug dérivé déjà pris est remplacé par la
 *   suggestion du serveur (`x-2`), sans rien demander.
 * - `manual` : l'utilisateur l'a saisi, ou on édite un slug existant. Le titre
 *   n'y touche plus, et un slug pris est signalé, jamais remplacé en silence.
 *
 * Vider le champ ne le rend **pas** au titre : on vide pour réécrire le slug en
 * entier, et le voir se remplir sous ses doigts rendrait la saisie impossible.
 * Un champ vide ou trop court bloque simplement l'envoi, avec le slug dérivé du
 * titre proposé d'un clic.
 */

export type SlugEntity = keyof typeof SLUG_FALLBACK;

export type SlugCheck =
  /** Rien à vérifier : champ vide, ou saisie en cours qui finit par un tiret. */
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'available' }
  /** La vérification n'a pas abouti (réseau, droits) : le serveur tranchera à l'envoi. */
  | { status: 'unverified' }
  | { status: 'taken'; message: string; suggestion: string | null }
  | { status: 'invalid'; message: string; suggestion: string | null };

export interface SlugFieldState {
  value: string;
  mode: 'auto' | 'manual';
  /** Le slug enregistré, en édition. En changer laisse celui-ci en redirection. */
  saved: string | null;
  /** La ligne éditée, exclue de la vérification : son slug reste le sien. */
  excludeId: string | null;
  fallback: string;
  check: SlugCheck;
  /** En `auto`, le slug dérivé du titre qui était pris et a été numéroté. */
  replaced: string | null;
}

export type SlugFieldAction =
  | { type: 'reset'; title: string; value?: string; saved?: string | null; excludeId?: string | null }
  | { type: 'title'; title: string }
  | { type: 'input'; raw: string; title: string }
  | { type: 'blur'; title: string }
  | { type: 'result'; slug: string; available: boolean; message: string | null; suggestion: string | null }
  | { type: 'unverified'; slug: string }
  | { type: 'applySuggestion' }
  | { type: 'conflict'; message: string; suggestion: string | null };

function derive(title: string, fallback: string): string {
  return title.trim() ? slugify(title, fallback) : '';
}

/** Ce qu'il y a à savoir d'une valeur avant même d'interroger le serveur. */
function localCheck(value: string, saved: string | null, fallback: string): SlugCheck {
  if (!value || value.endsWith('-')) return { status: 'idle' };
  if (value === saved) return { status: 'available' };
  const problem = slugProblem(value);
  if (problem) {
    const suggestion = slugify(value, fallback);
    return { status: 'invalid', message: problem, suggestion: suggestion === value ? null : suggestion };
  }
  return { status: 'checking' };
}

/**
 * Le champ vidé à la main : invalide, avec un slug à reprendre d'un clic — le
 * slug enregistré en édition, celui du titre à la création.
 */
function emptyCheck(title: string, saved: string | null, fallback: string): SlugCheck {
  return { status: 'invalid', message: slugProblem('')!, suggestion: saved ?? (derive(title, fallback) || null) };
}

export function initialSlugFieldState(entity: SlugEntity): SlugFieldState {
  return {
    value: '',
    mode: 'auto',
    saved: null,
    excludeId: null,
    fallback: SLUG_FALLBACK[entity],
    check: { status: 'idle' },
    replaced: null,
  };
}

export function slugFieldReducer(state: SlugFieldState, action: SlugFieldAction): SlugFieldState {
  switch (action.type) {
    case 'reset': {
      // Une valeur fournie (édition, promotion) est un choix : `manual`.
      const manual = action.value !== undefined;
      const value = manual ? action.value! : derive(action.title, state.fallback);
      const saved = action.saved ?? null;
      return {
        ...state,
        value,
        mode: manual ? 'manual' : 'auto',
        saved,
        excludeId: action.excludeId ?? null,
        replaced: null,
        check: localCheck(value, saved, state.fallback),
      };
    }

    case 'title': {
      if (state.mode !== 'auto') {
        // Champ vidé : la suggestion suit le titre, la valeur reste vide.
        return state.value === '' ? { ...state, check: emptyCheck(action.title, state.saved, state.fallback) } : state;
      }
      const value = derive(action.title, state.fallback);
      // Titre inchangé en substance : garder un éventuel remplacement numéroté.
      if (value === state.value || value === state.replaced) return state;
      return { ...state, value, replaced: null, check: localCheck(value, state.saved, state.fallback) };
    }

    case 'input': {
      const value = normalizeSlugInput(action.raw);
      return {
        ...state,
        value,
        mode: 'manual',
        replaced: null,
        check: value ? localCheck(value, state.saved, state.fallback) : emptyCheck(action.title, state.saved, state.fallback),
      };
    }

    case 'blur': {
      const value = normalizeSlugInput(state.value, { final: true });
      if (value === state.value) return state;
      return {
        ...state,
        value,
        check: value ? localCheck(value, state.saved, state.fallback) : emptyCheck(action.title, state.saved, state.fallback),
      };
    }

    case 'result': {
      // Réponse à une valeur que l'utilisateur a déjà changée : périmée.
      if (action.slug !== state.value) return state;
      if (action.available) return { ...state, check: { status: 'available' } };
      if (state.mode === 'auto' && action.suggestion) {
        return { ...state, value: action.suggestion, replaced: action.slug, check: { status: 'available' } };
      }
      return {
        ...state,
        check: { status: 'taken', message: action.message ?? 'This address is already taken.', suggestion: action.suggestion },
      };
    }

    case 'unverified':
      return action.slug === state.value ? { ...state, check: { status: 'unverified' } } : state;

    case 'applySuggestion': {
      if (state.check.status !== 'taken' && state.check.status !== 'invalid') return state;
      const suggestion = state.check.suggestion;
      if (!suggestion) return state;
      return {
        ...state,
        value: suggestion,
        mode: 'manual',
        replaced: null,
        check: localCheck(suggestion, state.saved, state.fallback),
      };
    }

    case 'conflict':
      return { ...state, check: { status: 'taken', message: action.message, suggestion: action.suggestion } };
  }
}

/** Le formulaire peut partir : slug libre, ou invérifiable (le serveur tranchera). */
export function isSlugReady(state: SlugFieldState): boolean {
  return state.value !== '' && (state.check.status === 'available' || state.check.status === 'unverified');
}

/** La valeur à envoyer, sans le tiret final d'une saisie interrompue. */
export function slugToSubmit(state: SlugFieldState): string {
  return normalizeSlugInput(state.value, { final: true });
}

/** En édition, le slug a changé : l'ancien deviendra une redirection. */
export function isSlugChanged(state: SlugFieldState): boolean {
  return state.saved !== null && slugToSubmit(state) !== state.saved;
}
