## Context

A score nobody can explain is a score nobody trusts.

The first evaluator returned a number. It was defensible, roughly, to whoever had written it — and to no one else. A contributor who scored 62 had no way to know which part of the delivery cost them the other 38, so the score changed nothing about the next contribution.

This update replaces the number with a grid: named criteria, weights that are published before the work starts, and a comment per criterion once it is graded.

## Objective

What has to be shipped:

- An evaluation grid stored per challenge: criteria, weights, and what each level means.
- An agent run that grades against that grid and returns a comment per criterion, not a single verdict.
- The grid shown to the contributor before they start, so the target is known rather than discovered.

## Expected result

- A pull request from your branch, with the board reflecting what it contains.
- One evaluation replayed under both the old and the new path, with the difference in what a contributor can read from it.
