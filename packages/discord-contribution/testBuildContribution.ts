import { readDiscordLogs } from "./readLogs";
import { buildContribution } from "./buildContribution";
import * as fs from "fs";

async function run() {
  const events = await readDiscordLogs();

  if (events.length === 0) {
    console.log("No events found");
    return;
  }

  const lastEvent = events[events.length - 1];
  const contribution = buildContribution(lastEvent);

  console.log(JSON.stringify(contribution, null, 2));
  console.log("\n=== DESCRIPTION (READABLE) ===\n");
  console.log(contribution.description);

  fs.writeFileSync(
    "logs/demo_contribution.json",
    JSON.stringify(contribution, null, 2)
  );

  console.log("Contribution saved to logs/demo_contribution.json");
}

run();