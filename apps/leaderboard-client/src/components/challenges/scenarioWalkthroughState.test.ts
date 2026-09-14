import { describe, it, expect } from 'vitest';
import {
  firstUnansweredIndex,
  finishBlocker,
  finishHint,
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
    expect(finishBlocker(steps('passed', null, 'failed'), 'Solid.')).toBe('1 step still has no result');
  });

  it('names them in the plural', () => {
    expect(finishBlocker(steps(null, null, 'passed'), 'Solid.')).toBe('2 steps still have no result');
  });

  it('reports unanswered steps before the missing feedback — fix the bigger gap first', () => {
    expect(finishBlocker(steps('passed', null), '')).toBe('1 step still has no result');
  });

  it('reports the missing overall feedback once every step is answered', () => {
    expect(finishBlocker(steps('passed', 'failed'), '   ')).toBe('The overall feedback is required');
  });

  it('returns null when the walkthrough is ready to finish', () => {
    expect(finishBlocker(steps('passed', 'failed'), 'Usable end to end.')).toBeNull();
  });
});

describe('finishHint', () => {
  it('says what the walkthrough pays once it is ready', () => {
    expect(finishHint(steps('passed'), 'Usable.', 200)).toBe('Pays 200 CP from the remaining pool');
  });

  it('otherwise states exactly why the button is disabled', () => {
    expect(finishHint(steps('passed', null), 'Usable.', 200)).toBe('1 step still has no result');
  });
});
