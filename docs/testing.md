# Testing

## Unit & integration tests (Vitest)

Tests use **Vitest** with Testing Library for React components.

**Run them from `apps/leaderboard-client`:**

```bash
cd apps/leaderboard-client && npx vitest run
```

That package has the only Vitest config that maps the `@/…` alias (`apps/leaderboard-client/vitest.config.ts`). The root `npm test` picks up the same files without that alias, so every suite whose route imports an unmocked `@/…` module fails to load there — a known gap in the root runner, not a broken test. Use the app-level runner as the gate.

Useful variants:

```bash
npm run test:watch      # watch mode (re-runs on file changes)
npm run test:coverage   # generate coverage report
```

Test files live alongside the code they test, typically as `*.test.ts` or `*.spec.ts`.

---

## Ad-hoc integration scripts (`packages/test`)

These are manual test scripts for verifying integrations — they are not Vitest tests. Run them directly with `tsx`:

```bash
npx tsx packages/test/test-db-connection.ts
npx tsx packages/test/test-github.ts
npx tsx packages/test/test-gd.ts            # Google Drive
npx tsx packages/test/test-provisioner.ts
```

Others in that folder (`test-challenge-service.ts`, `test-create-challenge.ts`, `test-webhook-service.ts`) predate the current model — `test-webhook-service.ts` exercises a service nothing calls any more.

> These scripts read from your `.env` file. Some require optional credentials (GitHub token, Google OAuth, OpenAI key).

---

## What to test when contributing

When adding a new feature or fixing a bug:

1. **Add a Vitest test** for any logic that can be tested in isolation (utilities, transformations, validators).
2. **Use the ad-hoc scripts** in `packages/test/` if you're touching a connector, the evaluator, or the database service and want to verify the integration against real credentials.
3. **Run `npx vitest run` from `apps/leaderboard-client`** before opening a PR, and `npx tsc --noEmit` there too — there is no working ESLint config in the repo, so those two are the gate.
