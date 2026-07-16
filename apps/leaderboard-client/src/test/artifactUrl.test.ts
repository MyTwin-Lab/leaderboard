import { describe, it, expect } from 'vitest';
import { normalizeArtifactUrl } from '../../../../packages/services/challenge/artifactUrl';

describe('normalizeArtifactUrl — Kaggle datasets', () => {
  it('collapses casing and trailing slashes to one key', () => {
    const a = normalizeArtifactUrl('https://www.kaggle.com/datasets/Alice/My-Dataset/');
    const b = normalizeArtifactUrl('https://kaggle.com/datasets/alice/my-dataset');
    expect(a).toBe('kaggle.com/datasets/alice/my-dataset');
    expect(a).toBe(b);
  });

  it('ignores tracking query params and fragments', () => {
    expect(normalizeArtifactUrl('https://kaggle.com/datasets/alice/ds?utm_source=x#files'))
      .toBe('kaggle.com/datasets/alice/ds');
  });

  it('treats a new version as the same dataset', () => {
    // Reuse must be detected across versions — a v2 is still Alice's dataset
    expect(normalizeArtifactUrl('https://kaggle.com/datasets/alice/ds/versions/3'))
      .toBe('kaggle.com/datasets/alice/ds');
  });

  it('keeps different datasets distinct', () => {
    expect(normalizeArtifactUrl('https://kaggle.com/datasets/alice/ds'))
      .not.toBe(normalizeArtifactUrl('https://kaggle.com/datasets/bob/ds'));
  });
});

describe('normalizeArtifactUrl — Kaggle models', () => {
  it('collapses framework and variation paths onto the model', () => {
    expect(normalizeArtifactUrl('https://www.kaggle.com/models/alice/bert/pyTorch/base/1'))
      .toBe('kaggle.com/models/alice/bert');
  });

  it('does not confuse a model with a dataset of the same slug', () => {
    expect(normalizeArtifactUrl('https://kaggle.com/models/alice/x'))
      .not.toBe(normalizeArtifactUrl('https://kaggle.com/datasets/alice/x'));
  });
});

describe('normalizeArtifactUrl — GitHub', () => {
  it('strips .git and deep paths', () => {
    expect(normalizeArtifactUrl('https://github.com/Org/Repo.git')).toBe('github.com/org/repo');
    expect(normalizeArtifactUrl('https://github.com/org/repo/tree/main/src')).toBe('github.com/org/repo');
  });
});

describe('normalizeArtifactUrl — rejects unusable input', () => {
  it.each([
    ['empty', ''],
    ['whitespace', '   '],
    ['not a url', 'just some text'],
    ['bare host', 'https://kaggle.com'],
    ['non-http scheme', 'ftp://kaggle.com/datasets/a/b'],
    ['javascript scheme', 'javascript:alert(1)'],
  ])('returns undefined for %s', (_label, input) => {
    expect(normalizeArtifactUrl(input)).toBeUndefined();
  });

  it('returns undefined for null and undefined', () => {
    expect(normalizeArtifactUrl(null)).toBeUndefined();
    expect(normalizeArtifactUrl(undefined)).toBeUndefined();
  });

  it('falls back to host + path for unknown hosts rather than dropping them', () => {
    expect(normalizeArtifactUrl('https://huggingface.co/Alice/Model/'))
      .toBe('huggingface.co/alice/model');
  });
});
