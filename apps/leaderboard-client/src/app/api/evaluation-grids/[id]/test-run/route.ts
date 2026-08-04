import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import fs from 'fs/promises';
import { verifyAdmin } from '@/lib/auth';
import { EvaluationGridsRepository } from '../../../../../../../../packages/database-service/repositories/evaluationGrids.repo.js';
import { convertGridToEvaluatorFormat } from '../../../../../../../../packages/services/database-grid-provider.js';
import { SnapshotService } from '../../../../../../../../packages/services/challenge/snapshot.service.js';
import { parseGitHubUrl, resolveGitHubCommitShas } from '../../../../../../../../packages/services/challenge/githubUrl.js';
import { extractArtifactRef } from '../../../../../../../../packages/services/challenge/artifactUrl.js';
import { GitHubExternalConnector } from '../../../../../../../../packages/connectors/implementation/Github.connector.js';
import { KaggleConnector } from '../../../../../../../../packages/connectors/implementation/Kaggle.connector.js';
import { getGithubToken } from '../../../../../../../../packages/config/githubToken.js';
import { getKaggleCredentials } from '../../../../../../../../packages/config/kaggleCredentials.js';
import { OpenAIAgentEvaluator } from '../../../../../../../../packages/evaluator/evaluator.js';
import type { EvaluateContext, SnapshotInfo, Contribution as EvalContribution, Evaluation } from '../../../../../../../../packages/evaluator/types.js';

const testRunSchema = z.object({
  sourceType: z.enum(['github', 'kaggle_dataset', 'kaggle_model']),
  sourceUrl: z.string().min(1),
  branch: z.string().optional(),
  title: z.string().optional(),
  contextNote: z.string().optional(),
});

const gridRepo = new EvaluationGridsRepository();
const snapshotService = new SnapshotService();

/** Fixed by design: the point of this sandbox is measuring how consistent
 * the grid's scoring is across repeated runs on the same content. */
const RUN_COUNT = 5;
/** Plafonné (la vraie pipeline task va jusqu'à 100) pour garder ce test rapide. */
const MAX_GITHUB_COMMITS = 20;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await verifyAdmin(request);
    if (!payload) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const parsedBody = testRunSchema.safeParse(body);
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parsedBody.error.issues },
        { status: 400 }
      );
    }
    const { sourceType, sourceUrl, branch: branchOverride, title, contextNote } = parsedBody.data;

    const grid = await gridRepo.findFullById(id);
    if (!grid) {
      return NextResponse.json({ error: 'Grid not found' }, { status: 404 });
    }
    if (grid.categories.length === 0) {
      return NextResponse.json(
        { error: 'Add at least one category before testing this grid' },
        { status: 400 }
      );
    }
    const evaluatorGrid = convertGridToEvaluatorFormat(grid);

    let snapshotInfo: SnapshotInfo | null = null;
    let derivedTitle = title;

    if (sourceType === 'github') {
      const parsedUrl = parseGitHubUrl(sourceUrl);
      if (!parsedUrl) {
        return NextResponse.json(
          { error: 'Could not parse this as a GitHub URL (expected a repo, branch, commit, or pull request link).' },
          { status: 400 }
        );
      }
      const token = await getGithubToken();
      if (!token) {
        return NextResponse.json(
          { error: 'No GitHub token configured — connect a GitHub account in Integrations, or set GITHUB_TOKEN.' },
          { status: 400 }
        );
      }
      const branch = branchOverride?.trim() || (parsedUrl.refType === 'branch' ? parsedUrl.ref : undefined);
      const connector = new GitHubExternalConnector({ token, owner: parsedUrl.owner, repo: parsedUrl.repo, branch });

      try {
        await connector.connect();
        const commitShas = await resolveGitHubCommitShas(parsedUrl, connector, token, MAX_GITHUB_COMMITS);
        if (commitShas.length === 0) {
          return NextResponse.json({ error: 'No commits found for this GitHub reference.' }, { status: 400 });
        }
        snapshotInfo = await snapshotService.buildAggregatedSnapshot(() => connector, commitShas);
      } catch (err) {
        return NextResponse.json(
          { error: err instanceof Error ? err.message : 'Failed to fetch this GitHub repo' },
          { status: 400 }
        );
      }
      derivedTitle = derivedTitle || `${parsedUrl.owner}/${parsedUrl.repo}`;
    } else {
      const ref = extractArtifactRef(sourceUrl);
      if (!ref) {
        return NextResponse.json({ error: 'Could not parse this as a Kaggle dataset/model URL.' }, { status: 400 });
      }
      const credentials = await getKaggleCredentials();
      if (!credentials) {
        return NextResponse.json(
          { error: 'No Kaggle credentials configured — connect a Kaggle account in Integrations.' },
          { status: 400 }
        );
      }
      const connector = new KaggleConnector({ ...credentials, ref, subtype: sourceType });

      try {
        await connector.connect();
        const items = await connector.fetchItems();
        if (items.length === 0) {
          return NextResponse.json({ error: 'Nothing found at this Kaggle URL.' }, { status: 400 });
        }
        const content = await connector.fetchItemContent(items[0].id);
        snapshotInfo = { commitSha: content.commitSha, modifiedFiles: content.modifiedFiles } as SnapshotInfo;
      } catch (err) {
        return NextResponse.json(
          { error: err instanceof Error ? err.message : 'Failed to fetch this Kaggle resource' },
          { status: 400 }
        );
      }
      derivedTitle = derivedTitle || ref;
    }

    if (!snapshotInfo) {
      return NextResponse.json({ error: 'Could not build a snapshot from this source.' }, { status: 400 });
    }

    const prepared = await snapshotService.prepareSnapshot(snapshotInfo);

    const contribution: EvalContribution = {
      title: derivedTitle || 'Test run',
      type: grid.slug,
      description: contextNote || undefined,
      challenge_id: 'test-run',
      userId: payload.userId,
      commitShas: prepared.commitShas ?? (prepared.commitSha ? [prepared.commitSha] : []),
    };

    const evalContext: EvaluateContext = { snapshot: prepared, grid: evaluatorGrid };
    const evaluator = new OpenAIAgentEvaluator();

    const settled = await Promise.allSettled(
      Array.from({ length: RUN_COUNT }, () => evaluator.evaluate(false, contribution, evalContext))
    );

    // Best-effort cleanup: unlike a real (one-off) task evaluation, this
    // sandbox is meant to be rerun repeatedly while iterating on a grid.
    if (prepared.workspacePath) {
      fs.rm(prepared.workspacePath, { recursive: true, force: true }).catch(() => {});
    }

    const runs = settled
      .filter((r): r is PromiseFulfilledResult<Evaluation> => r.status === 'fulfilled')
      .map((r) => r.value);
    const failedCount = settled.length - runs.length;

    if (runs.length === 0) {
      return NextResponse.json({ error: 'All evaluation runs failed. Check server logs for details.' }, { status: 502 });
    }

    return NextResponse.json({
      runs: runs.map((r) => ({ globalScore: r.globalScore, scores: r.scores })),
      failedCount,
      determinism: computeDeterminism(runs),
      perCriterion: computePerCriterion(runs),
    });
  } catch (error) {
    console.error('[EvaluationGrids] test-run POST error:', error);
    return NextResponse.json({ error: 'Failed to run grid test' }, { status: 500 });
  }
}

function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function stddev(values: number[], avg: number): number {
  if (values.length <= 1) return 0;
  const variance = values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/** stddev of 0 → 100%, stddev of 12.5 points → 0%. Arbitrary but simple;
 * recalibrate the ×8 factor once there's real usage to compare against. */
function computeDeterminism(runs: Evaluation[]) {
  const scores = runs.map((r) => r.globalScore);
  const avg = mean(scores);
  const sd = stddev(scores, avg);
  const score = Math.max(0, Math.min(100, Math.round(100 - sd * 8)));
  return { score, mean: Math.round(avg * 10) / 10, stddev: Math.round(sd * 10) / 10 };
}

function computePerCriterion(runs: Evaluation[]) {
  const byCriterion = new Map<string, number[]>();
  for (const run of runs) {
    for (const s of run.scores) {
      const list = byCriterion.get(s.criterion) ?? [];
      list.push(s.score);
      byCriterion.set(s.criterion, list);
    }
  }
  return Array.from(byCriterion.entries()).map(([criterion, values]) => {
    const avg = mean(values);
    return {
      criterion,
      mean: Math.round(avg * 10) / 10,
      stddev: Math.round(stddev(values, avg) * 10) / 10,
      values,
    };
  });
}
