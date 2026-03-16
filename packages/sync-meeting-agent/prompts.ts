import { MeetingAnalysisContext } from './types.js';

export function buildAnalysisPrompt(context: MeetingAnalysisContext): string {
  const participantsList = context.participants
    .map(p => `- ${p.display_name} (${p.utterances.length} interventions)`)
    .join('\n');

  const transcript = context.participants
    .flatMap(p => 
      p.utterances.map(u => ({
        time: u.start_time,
        speaker: p.display_name,
        text: u.text,
      }))
    )
    .sort((a, b) => a.time.getTime() - b.time.getTime())
    .map(u => `[${u.time.toISOString()}] ${u.speaker}: ${u.text}`)
    .join('\n');

  return `You are an AI assistant analyzing a Sync Meeting for MyTwin Lab.

**Meeting Information:**
- Title: ${context.meeting_title}
- Duration: ${context.duration_minutes} minutes
- Challenge: ${context.challenge_title || 'N/A'}
${context.challenge_roadmap ? `- Roadmap: ${context.challenge_roadmap}` : ''}

**Participants:**
${participantsList}

**Full Transcript:**
${transcript}

**Your Task:**
Analyze this meeting transcript and provide:

1. **Summary**: A concise summary (2-3 sentences) of what was discussed
2. **Key Points**: 3-7 main takeaways from the meeting
3. **Decisions**: Important decisions that were made (with context and who mentioned them)
4. **Actions**: Action items identified (with assignee if mentioned, deadline, priority)
5. **Contribution Signals**: For each participant, identify their contribution type and weight (0.0-1.0):
   - coordination: Facilitated discussion, aligned team
   - technical_leadership: Provided technical direction, solved complex problems
   - problem_solving: Identified and proposed solutions to issues
   - knowledge_sharing: Shared expertise, explained concepts

**Important:**
- Be objective and factual
- Only extract information explicitly mentioned in the transcript
- For contribution signals, base the weight on the quality and impact of contributions, not just quantity
- If no decisions or actions were identified, return empty arrays

Respond with a valid JSON object matching this structure:
{
  "summary": "string",
  "decisions": [{"description": "string", "context": "string", "mentioned_by": ["string"]}],
  "actions": [{"description": "string", "assignee": "string", "deadline": "string", "priority": "high|medium|low"}],
  "contribution_signals": [{"display_name": "string", "signal_type": "coordination|technical_leadership|problem_solving|knowledge_sharing", "weight": 0.0-1.0, "description": "string"}]
}`;
}
