@echo off
setlocal

call npm install || exit /b 1
call npx drizzle-kit generate || exit /b 1
call npx drizzle-kit push || exit /b 1

pushd apps\leaderboard-client
call npm install || exit /b 1
popd