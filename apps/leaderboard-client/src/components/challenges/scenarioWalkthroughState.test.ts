import { describe, it, expect } from 'vitest';
import {
  firstUnansweredIndex,
  finishBlocker,
  finishHint,
  mergeStepsAfterSave,
  type WalkthroughStepView,
} from './scenarioWalkthroughState';

function steps(...results: Array<WalkthroughStepView['result']>): WalkthroughStepView[] {
  return results.map((result, i) => ({
    stepId: `step-${i + 1}`, position: i, title: `Step ${i + 1}`, instructions: null,
    result, comment: null, medicalComment: null,
  }));
}

describe('firstUnansweredIndex', () => {
  it('reopens a draft on the first step with no result, not on step 1', () => {
    // Reprendre au début forcerait à re-cliquer sur ce qui est déjà répondu,
    // ce qui est exactement le travail que le brouillon devait épargner.
    expect(firstUnansweredIndex(steps('passed', 'passed', null, null))).toBe(2);
  });

  it('finds a gap left by someone who went back and cleared a step', () => {
    expect(firstUnansweredIndex(steps('passed', null, 'failed'))).toBe(1);
  });

  it('lands on the last step when everything is answered, so the final screen is one click away', () => {
    expect(firstUnansweredIndex(steps('passed', 'failed', 'blocked'))).toBe(2);
  });

  it('opens a fresh walkthrough on step 1', () => {
    expect(firstUnansweredIndex(steps(null, null))).toBe(0);
  });

  it('returns 0 rather than -1 on an empty scenario', () => {
    expect(firstUnansweredIndex([])).toBe(0);
  });
});

describe('finishBlocker', () => {
  it('names the number of unanswered steps, in the singular when there is one', () => {
    expect(finishBlocker(steps('passed', null, 'failed'), 'Solid.', 0)).toBe('1 step still has no result');
  });

  it('names them in the plural', () => {
    expect(finishBlocker(steps(null, null, 'passed'), 'Solid.', 0)).toBe('2 steps still have no result');
  });

  it('reports unanswered steps before the missing feedback — fix the bigger gap first', () => {
    expect(finishBlocker(steps('passed', null), '', 0)).toBe('1 step still has no result');
  });

  it('reports the missing overall feedback once every step is answered', () => {
    expect(finishBlocker(steps('passed', 'failed'), '   ', 0)).toBe('The overall feedback is required');
  });

  it('returns null when the walkthrough is ready to finish', () => {
    expect(finishBlocker(steps('passed', 'failed'), 'Usable end to end.', 0)).toBeNull();
  });

  it('reports a single unsaved step, in the singular', () => {
    expect(finishBlocker(steps('passed', 'passed'), 'Solid.', 1)).toBe('1 step could not be saved — retry before finishing');
  });

  it('reports several unsaved steps, in the plural', () => {
    expect(finishBlocker(steps('passed', 'passed'), 'Solid.', 3)).toBe('3 steps could not be saved — retry before finishing');
  });

  it('reports unsaved steps before unanswered steps and missing feedback — the least recoverable gap first', () => {
    expect(finishBlocker(steps(null, null), '', 1)).toBe('1 step could not be saved — retry before finishing');
  });
});

describe('finishHint', () => {
  it('says what the walkthrough pays once it is ready', () => {
    expect(finishHint(steps('passed'), 'Usable.', 200, 0)).toBe('Pays 200 CP from the remaining pool');
  });

  it('otherwise states exactly why the button is disabled', () => {
    expect(finishHint(steps('passed', null), 'Usable.', 200, 0)).toBe('1 step still has no result');
  });

  it('reports an unsaved step even once everything else is in order', () => {
    expect(finishHint(steps('passed'), 'Usable.', 200, 1)).toBe('1 step could not be saved — retry before finishing');
  });
});

describe('mergeStepsAfterSave', () => {
  it('takes the server value for a step whose local content matches what was last confirmed', () => {
    const confirmed = steps('passed', null);
    const local = steps('passed', null);
    const server = steps('passed', 'failed'); // someone else's step-2 update landed on the server

    const merged = mergeStepsAfterSave(local, confirmed, server, 'step-1');

    expect(merged[1].result).toBe('failed');
  });

  it('preserves a step whose local content still diverges from what was last confirmed, even though it was not the one just saved', () => {
    // Un commentaire tapé sur l'étape 2 sans résultat n'est jamais PUT : le
    // serveur ne l'a jamais vu, donc son snapshot ne le contient pas.
    const confirmed = steps(null, null);
    const local = steps('passed', null);
    local[1] = { ...local[1], comment: 'Typed but never sent' };
    const server = steps('passed', null); // step-1 just got confirmed; step-2 untouched server-side

    const merged = mergeStepsAfterSave(local, confirmed, server, 'step-1');

    expect(merged[1].comment).toBe('Typed but never sent');
  });

  it('always takes the server value for the step that was just saved', () => {
    const confirmed = steps(null, null);
    const local = steps('passed', null);
    const server = steps('passed', null);

    const merged = mergeStepsAfterSave(local, confirmed, server, 'step-1');

    expect(merged[0]).toEqual(server[0]);
  });
});
