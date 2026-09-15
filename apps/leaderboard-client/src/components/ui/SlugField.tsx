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
 * Même rendu dans les trois formulaires (tiroir de challenge, formulaire admin,
 * modale de sandbox) : c'est la même donnée, et la même règle.
 */
export function SlugField({ field, id }: { field: SlugFieldController; id?: string }) {
  const { state } = field;
  const prefix = `${HOST}/${SEGMENT[field.entity]}/`;

  return (
    <div className="space-y-1.5">
      <div className="flex min-w-0 items-center rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm transition-colors focus-within:border-brandCP/40 focus-within:shadow-[0_0_0_1px_rgba(10,247,193,0.15)]">
        <span className="shrink-0 select-none truncate text-white/30" title={prefix}>
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
          className="slug-field-input min-w-0 flex-1 bg-transparent text-white placeholder:text-white/20 focus:outline-none"
        />
      </div>
      <SlugStatus field={field} />
    </div>
  );
}

function SlugStatus({ field }: { field: SlugFieldController }) {
  const { state } = field;
  const { check } = state;
  const muted = 'text-[11px] leading-relaxed text-white/35';

  switch (check.status) {
    case 'idle':
      return state.mode === 'auto' ? <p className={muted}>Generated from the title - you can edit it.</p> : null;

    case 'checking':
      return (
        <p className={`flex items-center gap-1.5 ${muted}`}>
          <Loader2 className="h-3 w-3 animate-spin" />
          Checking availability…
        </p>
      );

    case 'unverified':
      return <p className={muted}>Availability couldn&apos;t be checked - it will be on save.</p>;

    case 'available':
      return (
        <p className="text-[11px] leading-relaxed text-brandCP/80">
          {/* En ligne, pas en flex : un message long revient à la ligne sous le texte, pas sous l'icône. */}
          <Check className="mr-1 inline h-3 w-3 -translate-y-px" />
          {state.replaced
            ? <span>Available. &ldquo;{state.replaced}&rdquo; was taken, so this one is numbered.</span>
            : field.changed
              ? <span>Available. The current address <code className="font-mono">/{SEGMENT[field.entity]}/{state.saved}</code> will redirect here.</span>
              : <span>Available.</span>}
        </p>
      );

    case 'taken':
    case 'invalid':
      return (
        <p className="flex flex-wrap items-center gap-x-2 text-[11px] leading-relaxed text-red-400">
          <span>{check.message}</span>
          {check.suggestion && (
            <button
              type="button"
              onClick={field.applySuggestion}
              className="rounded-md bg-white/[0.06] px-1.5 py-0.5 font-mono text-white/70 transition-colors hover:bg-white/[0.1] hover:text-white"
            >
              Use {check.suggestion}
            </button>
          )}
        </p>
      );
  }
}
