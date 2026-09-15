import { describe, expect, it } from 'vitest';
import {
  initialSlugFieldState,
  isSlugChanged,
  isSlugReady,
  slugFieldReducer,
  slugToSubmit,
  type SlugFieldAction,
  type SlugFieldState,
} from './slugField';

function run(actions: SlugFieldAction[], state: SlugFieldState = initialSlugFieldState('challenge')) {
  return actions.reduce(slugFieldReducer, state);
}

describe('slugFieldReducer — creation', () => {
  it('follows the title while nobody has touched the field', () => {
    const state = run([
      { type: 'reset', title: '' },
      { type: 'title', title: 'Mammography' },
      { type: 'title', title: 'Mammography Classification' },
    ]);
    expect(state.value).toBe('mammography-classification');
    expect(state.mode).toBe('auto');
    expect(state.check.status).toBe('checking');
  });

  it('numbers a derived slug that is taken, without asking', () => {
    const state = run([
      { type: 'title', title: 'MyKine' },
      { type: 'result', slug: 'mykine', available: false, message: 'taken', suggestion: 'mykine-2' },
    ]);
    expect(state.value).toBe('mykine-2');
    expect(state.replaced).toBe('mykine');
    expect(isSlugReady(state)).toBe(true);
  });

  it('keeps the numbered slug when the title re-derives the same base', () => {
    const state = run([
      { type: 'title', title: 'MyKine' },
      { type: 'result', slug: 'mykine', available: false, message: 'taken', suggestion: 'mykine-2' },
      { type: 'title', title: 'MyKine ' },
    ]);
    expect(state.value).toBe('mykine-2');
  });

  it('stops following the title once the user types, and signals a taken slug instead of replacing it', () => {
    const state = run([
      { type: 'title', title: 'Mammography Classification' },
      { type: 'input', raw: 'Mammo', title: 'Mammography Classification' },
      { type: 'title', title: 'Something else' },
      { type: 'result', slug: 'mammo', available: false, message: 'This address is already taken.', suggestion: 'mammo-2' },
    ]);
    expect(state.mode).toBe('manual');
    expect(state.value).toBe('mammo');
    expect(state.check).toEqual({ status: 'taken', message: 'This address is already taken.', suggestion: 'mammo-2' });
    expect(isSlugReady(state)).toBe(false);
  });

  it('applies the suggestion on request, and checks it again', () => {
    const state = run([
      { type: 'input', raw: 'mammo', title: '' },
      { type: 'result', slug: 'mammo', available: false, message: 'taken', suggestion: 'mammo-2' },
      { type: 'applySuggestion' },
    ]);
    expect(state.value).toBe('mammo-2');
    expect(state.check.status).toBe('checking');
  });

  it('stays empty when the field is cleared, so the slug can be retyped from scratch', () => {
    const state = run([
      { type: 'title', title: 'Breast Cancer' },
      { type: 'input', raw: '', title: 'Breast Cancer' },
      { type: 'title', title: 'Breast Cancer Detection' },
      { type: 'blur', title: 'Breast Cancer Detection' },
    ]);
    expect(state.value).toBe('');
    expect(state.mode).toBe('manual');
    // Bloqué, avec le slug du titre (à jour) proposé d'un clic.
    expect(state.check).toMatchObject({ status: 'invalid', suggestion: 'breast-cancer-detection' });
    expect(isSlugReady(state)).toBe(false);
  });

  it('lets the user type a new slug over a cleared one', () => {
    const state = run([
      { type: 'title', title: 'Breast Cancer' },
      { type: 'input', raw: '', title: 'Breast Cancer' },
      { type: 'input', raw: 'm', title: 'Breast Cancer' },
      { type: 'input', raw: 'my', title: 'Breast Cancer' },
    ]);
    expect(state.value).toBe('my');
    expect(state.check).toMatchObject({ status: 'invalid' });
    expect(isSlugReady(state)).toBe(false);

    const longer = slugFieldReducer(state, { type: 'input', raw: 'mykine', title: 'Breast Cancer' });
    expect(longer.check.status).toBe('checking');
  });

  it('brings the title-derived slug back only when asked', () => {
    const state = run([
      { type: 'title', title: 'Breast Cancer' },
      { type: 'input', raw: '', title: 'Breast Cancer' },
      { type: 'applySuggestion' },
    ]);
    expect(state.value).toBe('breast-cancer');
    expect(state.check.status).toBe('checking');
  });

  it('tolerates a trailing hyphen while typing, and trims it on blur', () => {
    const typing = run([{ type: 'input', raw: 'breast-', title: '' }]);
    expect(typing.check.status).toBe('idle');

    const blurred = slugFieldReducer(typing, { type: 'blur', title: '' });
    expect(blurred.value).toBe('breast');
    expect(blurred.check.status).toBe('checking');
  });

  it('refuses a malformed slug locally, with a suggestion, and never asks the server', () => {
    const state = run([{ type: 'input', raw: 'ab', title: '' }]);
    expect(state.check).toMatchObject({ status: 'invalid', suggestion: 'ab-challenge' });
  });

  it('ignores a stale availability answer', () => {
    const state = run([
      { type: 'input', raw: 'first', title: '' },
      { type: 'input', raw: 'second', title: '' },
      { type: 'result', slug: 'first', available: true, message: null, suggestion: null },
    ]);
    expect(state.check.status).toBe('checking');
  });

  it('lets the form go when the check could not run: the server decides', () => {
    const state = run([
      { type: 'input', raw: 'mykine', title: '' },
      { type: 'unverified', slug: 'mykine' },
    ]);
    expect(isSlugReady(state)).toBe(true);
  });

  it('shows a 409 from the server on the field', () => {
    const state = run([
      { type: 'input', raw: 'mykine', title: '' },
      { type: 'result', slug: 'mykine', available: true, message: null, suggestion: null },
      { type: 'conflict', message: 'The address "mykine" is already taken.', suggestion: 'mykine-2' },
    ]);
    expect(state.check).toMatchObject({ status: 'taken', suggestion: 'mykine-2' });
    expect(isSlugReady(state)).toBe(false);
  });
});

describe('slugFieldReducer — edit', () => {
  const editing = run([{ type: 'reset', title: 'Breast Cancer Detection', value: 'breast-cancer-detection', saved: 'breast-cancer-detection', excludeId: 'c1' }]);

  it('starts on the saved slug, available, and ignores title changes', () => {
    expect(editing.mode).toBe('manual');
    expect(editing.check.status).toBe('available');
    expect(isSlugChanged(editing)).toBe(false);
    expect(slugFieldReducer(editing, { type: 'title', title: 'Renamed' }).value).toBe('breast-cancer-detection');
  });

  it('knows when the slug changed, so the form can say the old one will redirect', () => {
    const state = slugFieldReducer(editing, { type: 'input', raw: 'breast-cancer', title: 'x' });
    expect(isSlugChanged(state)).toBe(true);
    expect(slugToSubmit(state)).toBe('breast-cancer');
  });

  it('does not restore the saved slug when the field is cleared, but offers it back', () => {
    const state = slugFieldReducer(editing, { type: 'input', raw: '', title: 'Renamed title' });
    expect(state.value).toBe('');
    expect(isSlugReady(state)).toBe(false);
    // Le slug enregistré, pas celui du titre modifié.
    expect(state.check).toMatchObject({ status: 'invalid', suggestion: 'breast-cancer-detection' });
  });

  it('is available again, without a request, when set back to the saved slug', () => {
    const changed = slugFieldReducer(editing, { type: 'input', raw: 'other', title: 'x' });
    const back = slugFieldReducer(changed, { type: 'input', raw: 'breast-cancer-detection', title: 'x' });
    expect(back.check.status).toBe('available');
  });
});
