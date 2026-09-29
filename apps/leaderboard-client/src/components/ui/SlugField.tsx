'use client';

import { Check, Loader2 } from 'lucide-react';
import { SITE_URL } from '@/lib/seo';
import type { SlugFieldController } from '@/lib/useSlugField';

const SEGMENT = { challenge: 'challenges', sandbox: 'sandbox' } as const;
const HOST = new URL(SITE_URL).host;

/**
 * Le champ slug : l'adresse publique en toutes lettres, la partie modifiable
 * en input, et une ligne d'état qui dit si elle est libre.
 *
 * Sur le vocabulaire vitrine (`.v-slug*`) — la même boîte que la modale de
 * sandbox : c'est la même donnée, et la même règle.
 */
export function SlugField({ field, id }: { field: SlugFieldController; id?: string }) {
  const { state } = field;
  const prefix = `${HOST}/${SEGMENT[field.entity]}/`;

  return (
    <div className="v-field">
      <div className="v-slug">
        <span className="v-slug-prefix" title={prefix}>
          {prefix}
        </span>
        <input
          id={id}
          type="text"
          value={field.value}
          onChange={(e) => field.onChange(e.target.value)}
          onBlur={field.onBlur}
          placeholder="generated-from-the-title"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          aria-invalid={state.check.status === 'taken' || state.check.status === 'invalid'}
          className="v-bare"
        />
      </div>
      <SlugStatus field={field} />
    </div>
  );
}

function SlugStatus({ field }: { field: SlugFieldController }) {
  const { state } = field;
  const { check } = state;

  switch (check.status) {
    case 'idle':
      return state.mode === 'auto' ? <p className="v-slug-status">Generated from the title - you can edit it.</p> : null;

    case 'checking':
      return (
        <p className="v-slug-status">
          <Loader2 className="v-spin" />
          Checking availability…
        </p>
      );

    case 'unverified':
      return <p className="v-slug-status">Availability couldn&apos;t be checked - it will be on save.</p>;

    case 'available':
      return (
        <p className="v-slug-status" data-tone="ok">
          <Check />
          {state.replaced
            ? <span>Available. &ldquo;{state.replaced}&rdquo; was taken, so this one is numbered.</span>
            : field.changed
              ? <span>Available. The current address <code className="v-code">/{SEGMENT[field.entity]}/{state.saved}</code> will redirect here.</span>
              : <span>Available.</span>}
        </p>
      );

    case 'taken':
    case 'invalid':
      return (
        <p className="v-slug-status" data-tone="error">
          <span>{check.message}</span>
          {check.suggestion && (
            <button type="button" onClick={field.applySuggestion} className="v-slug-use">
              Use {check.suggestion}
            </button>
          )}
        </p>
      );
  }
}
