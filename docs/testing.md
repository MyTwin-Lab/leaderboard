# Testing

## Root tests

From the repo root:

```bash
npm test
```

Useful variants:

```bash
npm run test:watch
npm run test:coverage
```

## Leaderboard client tests

From `apps/leaderboard-client`:

```bash
npm test
```

Or from the repo root:

```bash
cd apps/leaderboard-client && npm test
```

## Script-based checks (packages/test)

This repo also includes ad-hoc scripts under `packages/test/` (DB connection, connectors, services). They are typically run with `tsx`, for example:

```bash
npx tsx packages/test/test-db-connection.ts
```

Note: some of these scripts require optional environment variables (GitHub / Google / OpenAI).


