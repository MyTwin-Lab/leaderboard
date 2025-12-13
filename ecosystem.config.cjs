/**
 * PM2 ecosystem file for production runtime.
 *
 * Usage (from repo root):
 *   - Build:  npm run prod:build
 *   - Start:  npm run prod
 *
 * Notes:
 * - `PORT` is read from the shell environment (default: 3000).
 * - `.env` is sourced by `scripts/prod.sh` before PM2 loads this file.
 */
module.exports = {
  apps: [
    {
      name: "leaderboard-client",
      cwd: "./apps/leaderboard-client",
      script: "npm",
      args: ["run", "start", "--", "-p", String(process.env.PORT || 3014)],
      env: {
        NODE_ENV: "production",
        PORT: String(process.env.PORT || 3014),
      },
    },
  ],
};


