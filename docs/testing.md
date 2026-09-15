# Testing

## Unit & integration tests (Vitest)

Tests use **Vitest** with Testing Library for React components.

**Run them from `apps/leaderboard-client`:**

```bash
cd apps/leaderboard-client && npx vitest run
```

That package has the only Vitest config that maps the `@/…` alias (`apps/leaderboard-client/vitest.config.ts`). The root `npm test` picks up the same files without that alias, so every suite whose route imports an unmocked `@/…` module fails to load there — a known gap in the root runner, not a broken test. Use the app-level runner as the gate.

The core, the content and the modules (`packages/`, `content/`, `modules/`) run from the repo root, in the `packages` project of the root `vitest.config.ts`:

```bash
npx vitest run --dir . packages/ content/ modules/
```

Useful variants:

```bash
npm run test:watch      # watch mode (re-runs on file changes)
npm run test:coverage   # generate coverage report
```

Test files live alongside the code they test, typically as `*.test.ts` or `*.spec.ts`.

---

## What to test when contributing

When adding a new feature or fixing a bug:

1. **Add a Vitest test** for any logic that can be tested in isolation (utilities, transformations, validators).
2. **Run `npx vitest run` from `apps/leaderboard-client`** before opening a PR, and `npx tsc --noEmit` there too — there is no working ESLint config in the repo, so those two are the gate.
