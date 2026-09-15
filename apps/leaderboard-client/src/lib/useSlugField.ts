'use client';

import { useCallback, useEffect, useReducer } from 'react';
import {
  initialSlugFieldState,
  isSlugChanged,
  isSlugReady,
  slugFieldReducer,
  slugToSubmit,
  type SlugEntity,
} from './slugField';

/** Le temps de laisser finir la frappe avant d'interroger le serveur. */
const CHECK_DELAY_MS = 300;

const AVAILABILITY_ENDPOINT: Record<SlugEntity, string> = {
  challenge: '/api/challenges/slug-availability',
  sandbox: '/api/sandboxes/slug-availability',
};

/**
 * Le champ slug d'un formulaire : l'état de `slugField.ts`, alimenté par le
 * titre et par l'endpoint de disponibilité de l'entité.
 *
 * La vérification ne réserve rien — l'index unique tranche à l'envoi, et le
 * formulaire affiche alors le 409 sur le champ (`conflict`).
 */
export function useSlugField(entity: SlugEntity, title: string) {
  const [state, dispatch] = useReducer(slugFieldReducer, entity, initialSlugFieldState);

  useEffect(() => {
    dispatch({ type: 'title', title });
  }, [title]);

  const { value, excludeId } = state;
  const checking = state.check.status === 'checking';

  useEffect(() => {
    if (!checking) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const params = new URLSearchParams({ slug: value });
      if (excludeId) params.set('exclude', excludeId);
      try {
        const res = await fetch(`${AVAILABILITY_ENDPOINT[entity]}?${params}`, { signal: controller.signal });
        if (!res.ok) {
          dispatch({ type: 'unverified', slug: value });
          return;
        }
        const data = (await res.json()) as { available: boolean; problem: string | null; suggestion: string | null };
        dispatch({ type: 'result', slug: value, available: data.available, message: data.problem, suggestion: data.suggestion });
      } catch {
        if (!controller.signal.aborted) dispatch({ type: 'unverified', slug: value });
      }
    }, CHECK_DELAY_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [checking, value, excludeId, entity]);

  const reset = useCallback(
    (options: { title: string; value?: string; saved?: string | null; excludeId?: string | null }) =>
      dispatch({ type: 'reset', ...options }),
    [],
  );

  return {
    entity,
    state,
    value: state.value,
    onChange: (raw: string) => dispatch({ type: 'input', raw, title }),
    onBlur: () => dispatch({ type: 'blur', title }),
    applySuggestion: () => dispatch({ type: 'applySuggestion' }),
    /** Un 409 reçu à l'envoi : le slug a été pris entre la vérification et l'écriture. */
    conflict: (message: string, suggestion: string | null) => dispatch({ type: 'conflict', message, suggestion }),
    reset,
    ready: isSlugReady(state),
    changed: isSlugChanged(state),
    submitValue: slugToSubmit(state),
  };
}

export type SlugFieldController = ReturnType<typeof useSlugField>;
