import { describe, it, expect } from 'vitest';
import { resolveLineage, type LineageContribution } from '../../../../packages/services/challenge/lineage';

const at = (iso: string) => new Date(iso);

const contrib = (over: Partial<LineageContribution> & { uuid: string; user_id: string }): LineageContribution => ({
  type: 'dataset',
  artifact_url: 'kaggle.com/datasets/alice/ds',
  submitted_at: at('2026-01-01T10:00:00Z'),
  ...over,
});

describe('resolveLineage', () => {
  it('credits the earliest submitter of an artifact as its author', () => {
    const contributions = [
      contrib({ uuid: 'c-alice', user_id: 'alice', submitted_at: at('2026-01-01T10:00:00Z') }),
      contrib({ uuid: 'c-bob', user_id: 'bob', submitted_at: at('2026-01-02T10:00:00Z') }),
    ];

    expect(resolveLineage(contributions, 'bob')).toEqual({
      datasetAuthorId: 'alice',
      datasetContributionId: 'c-alice',
    });
  });

  it('leaves the original author with no lineage of their own', () => {
    const contributions = [
      contrib({ uuid: 'c-alice', user_id: 'alice', submitted_at: at('2026-01-01T10:00:00Z') }),
      contrib({ uuid: 'c-bob', user_id: 'bob', submitted_at: at('2026-01-02T10:00:00Z') }),
    ];
    expect(resolveLineage(contributions, 'alice')).toEqual({});
  });

  it('does not treat a distinct artifact as reuse', () => {
    const contributions = [
      contrib({ uuid: 'c-alice', user_id: 'alice' }),
      contrib({
        uuid: 'c-bob',
        user_id: 'bob',
        artifact_url: 'kaggle.com/datasets/bob/other',
        submitted_at: at('2026-01-02T10:00:00Z'),
      }),
    ];
    expect(resolveLineage(contributions, 'bob')).toEqual({});
  });

  it('ignores contributions with no artifact url', () => {
    const contributions = [
      contrib({ uuid: 'c-bob', user_id: 'bob', artifact_url: undefined }),
    ];
    expect(resolveLineage(contributions, 'bob')).toEqual({});
  });

  it('tracks dataset and model reuse independently', () => {
    const contributions = [
      contrib({ uuid: 'c-alice-ds', user_id: 'alice', type: 'dataset' }),
      contrib({
        uuid: 'c-carol-m',
        user_id: 'carol',
        type: 'model',
        artifact_url: 'kaggle.com/models/carol/bert',
      }),
      contrib({
        uuid: 'c-bob-ds',
        user_id: 'bob',
        type: 'dataset',
        submitted_at: at('2026-01-03T10:00:00Z'),
      }),
      contrib({
        uuid: 'c-bob-m',
        user_id: 'bob',
        type: 'model',
        artifact_url: 'kaggle.com/models/carol/bert',
        submitted_at: at('2026-01-03T10:00:00Z'),
      }),
    ];

    expect(resolveLineage(contributions, 'bob')).toEqual({
      datasetAuthorId: 'alice',
      datasetContributionId: 'c-alice-ds',
      modelAuthorId: 'carol',
      modelContributionId: 'c-carol-m',
    });
  });

  it('does not let a dataset url match a model of the same url', () => {
    // The type must scope the lookup, otherwise a model would inherit a
    // dataset's author whenever both happen to share a url.
    const contributions = [
      contrib({ uuid: 'c-alice-ds', user_id: 'alice', type: 'dataset', artifact_url: 'x/y' }),
      contrib({
        uuid: 'c-bob-m',
        user_id: 'bob',
        type: 'model',
        artifact_url: 'x/y',
        submitted_at: at('2026-01-03T10:00:00Z'),
      }),
    ];
    expect(resolveLineage(contributions, 'bob')).toEqual({});
  });

  it('breaks timestamp ties deterministically rather than by list order', () => {
    // Same instant: without a tiebreak, the author would depend on row order
    // and points would move between users across calls.
    const sameInstant = at('2026-01-01T10:00:00Z');
    const forward = [
      contrib({ uuid: 'c-aaa', user_id: 'alice', submitted_at: sameInstant }),
      contrib({ uuid: 'c-zzz', user_id: 'bob', submitted_at: sameInstant }),
    ];
    const reversed = [...forward].reverse();

    expect(resolveLineage(forward, 'bob')).toEqual(resolveLineage(reversed, 'bob'));
    expect(resolveLineage(forward, 'bob').datasetAuthorId).toBe('alice');
  });

  it('returns nothing when the contributor has submitted nothing', () => {
    const contributions = [contrib({ uuid: 'c-alice', user_id: 'alice' })];
    expect(resolveLineage(contributions, 'bob')).toEqual({});
  });

  describe('datasetUsages (multi-dataset model attribution)', () => {
    it('splits weight evenly across own + community datasets, skipping the self-authored one', () => {
      const contributions = [
        contrib({ uuid: 'c-alice-ds', user_id: 'alice', artifact_url: 'ds/alice' }),
        contrib({ uuid: 'c-dave-ds', user_id: 'dave', artifact_url: 'ds/dave', submitted_at: at('2026-01-01T09:00:00Z') }),
        contrib({ uuid: 'c-carol-ds', user_id: 'carol', artifact_url: 'ds/carol', submitted_at: at('2026-01-02T10:00:00Z') }),
      ];

      const lineage = resolveLineage(contributions, 'carol', ['ds/carol', 'ds/alice', 'ds/dave']);

      expect(lineage.datasetUsages).toEqual(
        expect.arrayContaining([
          { authorId: 'alice', contributionId: 'c-alice-ds', weight: 1 / 3 },
          { authorId: 'dave', contributionId: 'c-dave-ds', weight: 1 / 3 },
        ])
      );
      expect(lineage.datasetUsages).toHaveLength(2); // carol's own dataset produces no entry
    });

    it('ignores a url nobody has ever submitted', () => {
      const contributions = [contrib({ uuid: 'c-alice-ds', user_id: 'alice', artifact_url: 'ds/alice' })];
      const lineage = resolveLineage(contributions, 'bob', ['ds/alice', 'ds/unclaimed']);
      expect(lineage.datasetUsages).toEqual([{ authorId: 'alice', contributionId: 'c-alice-ds', weight: 0.5 }]);
    });

    it('dedupes repeated urls before weighting', () => {
      const contributions = [contrib({ uuid: 'c-alice-ds', user_id: 'alice', artifact_url: 'ds/alice' })];
      const lineage = resolveLineage(contributions, 'bob', ['ds/alice', 'ds/alice']);
      expect(lineage.datasetUsages).toEqual([{ authorId: 'alice', contributionId: 'c-alice-ds', weight: 1 }]);
    });

    it('is a no-op when only your own dataset is in the set', () => {
      const contributions = [contrib({ uuid: 'c-alice-ds', user_id: 'alice', artifact_url: 'ds/alice' })];
      expect(resolveLineage(contributions, 'alice', ['ds/alice']).datasetUsages).toBeUndefined();
    });

    it('does not add datasetUsages when no urls are passed — unchanged legacy behavior', () => {
      const contributions = [
        contrib({ uuid: 'c-alice', user_id: 'alice', submitted_at: at('2026-01-01T10:00:00Z') }),
        contrib({ uuid: 'c-bob', user_id: 'bob', submitted_at: at('2026-01-02T10:00:00Z') }),
      ];
      expect(resolveLineage(contributions, 'bob', [])).toEqual({
        datasetAuthorId: 'alice',
        datasetContributionId: 'c-alice',
      });
    });
  });
});
