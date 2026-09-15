import { describe, expect, it, vi } from 'vitest';
import { toPublicRepoActivity } from './repoActivity';

const RAW = {
  'repo-1': { connectorKey: 'github', payload: { events: [{ type: 'commit' }, { type: 'branch_created' }] } },
  'repo-2': { error: 'ECONNREFUSED connecting to internal-runner.local:8443 with token ghp_xxx' },
  'repo-3': { connectorKey: 'kaggle', payload: { kind: 'model', modelVersions: [] } },
};

const githubFilter = (payload: any) => ({ events: payload.events.filter((e: any) => e.type !== 'branch_created') });
const filterFor = (key: string) => (key === 'github' ? githubFilter : undefined);

describe('toPublicRepoActivity', () => {
  it("applies the connector's own public filter to its payload", () => {
    expect(toPublicRepoActivity(RAW, filterFor)['repo-1']).toEqual({
      connectorKey: 'github',
      payload: { events: [{ type: 'commit' }] },
    });
  });

  it('replaces a connector error with a fixed string', () => {
    const out = toPublicRepoActivity(RAW, filterFor);
    expect(out['repo-2']).toEqual({ error: 'unavailable' });
    expect(JSON.stringify(out)).not.toContain('ghp_xxx');
    expect(JSON.stringify(out)).not.toContain('internal-runner.local');
  });

  it('passes through a payload whose connector declares no filter', () => {
    const lookup = vi.fn(filterFor);
    expect(toPublicRepoActivity(RAW, lookup)['repo-3']).toBe(RAW['repo-3']);
    expect(lookup).toHaveBeenCalledWith('kaggle');
  });

  it('drops anything that is neither an envelope nor an error', () => {
    expect(toPublicRepoActivity({ 'repo-4': { type: 'github', events: [] } }, filterFor)).toEqual({});
  });

  it('survives a null activities map', () => {
    expect(toPublicRepoActivity(null, filterFor)).toEqual({});
  });
});
