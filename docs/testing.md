# Testing

## Unit & integration tests (Vitest)

Tests use **Vitest** with Testing Library for React components.

Run all tests from the repo root:

```bash
npm test
```

Run tests for the Next.js app specifically:

```bash
cd apps/leaderboard-client && npm test
```

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
# Test the database connection
npx tsx packages/test/test-db-connection.ts

# Test the GitHub connector
npx tsx packages/test/test-github-connector.ts

# Test the Google Drive connector
npx tsx packages/test/test-google-drive-connector.ts
```

> These scripts read from your `.env` file. Some require optional credentials (GitHub token, Google OAuth, OpenAI key).

---

## What to test when contributing

When adding a new feature or fixing a bug:

1. **Add a Vitest test** for any logic that can be tested in isolation (utilities, transformations, validators).
2. **Use the ad-hoc scripts** in `packages/test/` if you're touching a connector, the evaluator, or the database service and want to verify the integration against real credentials.
3. **Run `npm test`** before opening a PR to make sure nothing is broken.
