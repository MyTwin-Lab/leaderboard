import { describe, expect, it } from 'vitest';
import { leadAndBody, splitBriefContext, stripInlineMarkdown } from './briefSections';

const BRIEF = `## Context

Rehabilitation is measured with a protractor and a good memory.

Between two sessions nothing is measured.

## Objective

- Ship a pose pipeline
- Ship a session history

## Expected result

A pull request from your branch.`;

describe('splitBriefContext', () => {
  it("lifts the Context section out, without its heading", () => {
    const { why } = splitBriefContext(BRIEF);
    expect(why).toContain('Rehabilitation is measured');
    expect(why).toContain('Between two sessions');
    expect(why).not.toContain('## Context');
    expect(why).not.toContain('Objective');
  });

  it('leaves every other section in reading order', () => {
    const { rest } = splitBriefContext(BRIEF);
    expect(rest.indexOf('## Objective')).toBe(0);
    expect(rest.indexOf('## Expected result')).toBeGreaterThan(0);
    expect(rest).not.toContain('Rehabilitation is measured');
  });

  it('matches the heading whatever its case and punctuation', () => {
    expect(splitBriefContext('## CONTEXTE :\n\nPourquoi.').why).toBe('Pourquoi.');
    expect(splitBriefContext('# context\n\nWhy.').why).toBe('Why.');
  });

  it('only lifts the first Context: a second one stays in the brief', () => {
    const { why, rest } = splitBriefContext('## Context\n\nOne.\n\n## Context\n\nTwo.');
    expect(why).toBe('One.');
    expect(rest).toContain('Two.');
  });

  it('leaves a brief without a Context section untouched', () => {
    const { why, rest } = splitBriefContext('## Objective\n\nShip it.');
    expect(why).toBeNull();
    expect(rest).toBe('## Objective\n\nShip it.');
  });

  it("a `###` inside Context belongs to it, not to what follows", () => {
    const { why, rest } = splitBriefContext('## Context\n\n### Today\n\nNothing.\n\n## Objective\n\nShip.');
    expect(why).toContain('### Today');
    expect(rest).toBe('## Objective\n\nShip.');
  });

  it('survives an empty brief', () => {
    expect(splitBriefContext(null)).toEqual({ why: null, rest: '' });
    expect(splitBriefContext('   ')).toEqual({ why: null, rest: '' });
  });
});

describe('leadAndBody', () => {
  it('cuts at the first paragraph', () => {
    const { lead, body } = leadAndBody('A claim.\n\nAn explanation.\n\nAnother one.');
    expect(lead).toBe('A claim.');
    expect(body).toEqual(['An explanation.', 'Another one.']);
  });

  it('a single paragraph is all lead', () => {
    expect(leadAndBody('Only this.')).toEqual({ lead: 'Only this.', body: [] });
  });
});

describe('stripInlineMarkdown', () => {
  it('drops the markup the serif line cannot render', () => {
    expect(stripInlineMarkdown('**Bold**, *italic*, `code` and [a link](https://x)'))
      .toBe('Bold, italic, code and a link');
  });

  it('folds a wrapped paragraph onto one line', () => {
    expect(stripInlineMarkdown('A claim\nsplit in two.')).toBe('A claim split in two.');
  });
});
