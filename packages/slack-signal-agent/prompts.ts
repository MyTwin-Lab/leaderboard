import { SlackSignalContext } from './types.js';

export function buildDetectionPrompt(context: SlackSignalContext): string {
  const participantsList = context.participants
    .map(p => `- ${p.full_name} (user_id: ${p.user_id})`)
    .join('\n');

  const signalsList = context.signals
    .map(s => `- "${s.label}" (signal_id: ${s.signal_id}, reward: ${s.reward_cp} CP)\n  Definition: ${s.description || 'No written definition provided.'}`)
    .join('\n');

  const messagesList = context.messages
    .map(m => {
      const author = m.author_user_id
        ? `${m.author_name} (user_id: ${m.author_user_id})`
        : `${m.author_name} (not a participant)`;
      return `[ts: ${m.ts}] ${author}: ${m.text}`;
    })
    .join('\n');

  return `You are an AI assistant analyzing Slack messages for MyTwin Lab's contribution leaderboard.

**Challenge Information:**
- Title: ${context.challenge.title}
${context.project_title ? `- Project: ${context.project_title}` : ''}
${context.challenge.description ? `- Description: ${context.challenge.description}` : ''}
${context.challenge.roadmap ? `- Roadmap: ${context.challenge.roadmap}` : ''}

**Challenge Participants:**
${participantsList}

**Contribution Signals to Detect:**
${signalsList}

**Slack Messages (chronological order):**
${messagesList}

**Your Task:**
Review each message and detect occurrences of the contribution signals defined above. For each detection, report the signal_id, the author's user_id, the message ts, and a one-sentence justification.

**Important rules:**
- Be conservative: only report a detection when the message clearly matches the signal definition. When in doubt, do not report.
- A single message may match several different signals, but a given (signal, message, user) pair must be reported at most once.
- Only attribute detections to challenge participants: ignore messages from authors marked "(not a participant)".
- Use exactly the signal_id, user_id and ts values provided above — never invent identifiers.
- If no signal is detected, return an empty detections array.

Respond with a valid JSON object matching this structure:
{
  "detections": [{"signal_id": "uuid", "user_id": "uuid", "message_ts": "string", "justification": "string"}]
}`;
}
