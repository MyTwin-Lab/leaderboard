# Discord Contribution Pipeline

## Overview
This project captures Discord interactions (messages + reactions) and converts them into structured contributions for the leaderboard evaluation system.

## Features
- Discord bot listening to messages and reactions
- Filters valid contribution signals (thanks emojis)
- Prevents self-reactions and duplicates
- Extracts conversation context
- Builds structured `Contribution` objects
- Prepares evaluation input for leaderboard agent

## Pipeline
1. Discord event (message / reaction)
2. Logger → JSONL logs
3. Transformation → Contribution object
4. Context generation → workspace/context.txt
5. Evaluation → leaderboard evaluator

## Tech
- TypeScript
- discord.js
- Node.js

## Run locally

```bash
npm install
npm run dev
```

# Test pipeline

```bash
npx tsx pipeline/testRead.ts
npx tsx pipeline/testBuildContribution.ts
npx tsx pipeline/testContext.ts
npx tsx pipeline/testEvaluation.ts
```

## Current status

### Done
- Discord bot connected and listening to messages/reactions
- Thanks reactions logged into structured JSONL files
- Self-reactions ignored
- Duplicate reactions filtered
- Discord events converted into `Contribution` objects
- Conversation context exported into `workspace/context.txt`

### In progress
- Final evaluator integration
- Real evaluation tests with API credentials
- Mapping Discord contributions to the most relevant evaluation grid

### Next steps
- Finalize evaluator call
- Store evaluation results in a dedicated JSONL file
- Prepare integration into the main leaderboard repository

# Notes 
- .env is required (BOT_TOKEN, OPENAI_API_KEY, JWT_SECRET)
- Logs are stored locally and not versioned
