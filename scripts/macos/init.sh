#!/bin/bash
set -e

echo "Installing root dependencies..."
npm install

echo "Running drizzle-kit generate..."
npx drizzle-kit generate

echo "Pushing database schema..."
npx drizzle-kit push

echo "Installing leaderboard-client dependencies..."
pushd apps/leaderboard-client
npm install
popd

echo "Initialization complete!"
