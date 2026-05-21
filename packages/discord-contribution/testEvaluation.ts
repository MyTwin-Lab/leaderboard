import { readDiscordLogs } from "./readLogs";
import { buildContribution } from "./buildContribution";
import { writeContextFile } from "./writeContext";
import { evaluateContribution } from "./evaluateContribution";

async function run() {

  const events = await readDiscordLogs();

  const event = events[events.length - 1];

  const contribution = buildContribution(event);

  const workspacePath = writeContextFile(event);

  const result = await evaluateContribution(contribution, workspacePath);

  console.log(result);

}

run();