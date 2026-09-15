web: cd apps/leaderboard-client && npm run start -- -p $PORT
postdeploy: npm run db:apply-schema && npm run db:upgrade-flow-configs && npm run db:seed-grids && npm run db:resync-rewards
