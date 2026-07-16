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
});
