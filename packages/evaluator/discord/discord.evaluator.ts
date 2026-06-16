import OpenAI from "openai";
import type { DiscordMessageItem } from "../../connectors/implementation/Discord.connector.js";
import type { CriterionScore } from "../types.js";
import { discordHelpGrid } from "../grids/discord_help.grid.js";
import { config } from "../../config/index.js";

// --- TYPES ---

export interface DiscordEvaluationInput {
  messages: DiscordMessageItem[];
  helper: { discord_id: string; username: string };
  beneficiary: { discord_id: string; username: string };
}

export interface DiscordContributionOutput {
  title: string;
  description: string;
  tags?: string[];
  evaluation: {
    globalScore: number;        // 0–100
    scores: CriterionScore[];
    justification: string;
  };
  skipped: boolean;
  skip_reason?: string;
}

const SKIP_THRESHOLD = 1.5; // score minimum sur 9 (grille discord_help)

export async function evaluateDiscordHelp(
  input: DiscordEvaluationInput
): Promise<DiscordContributionOutput> {
  const { messages, helper, beneficiary } = input;

  console.log("[evaluateDiscordHelp] messages count:", messages.length);
  console.log("[evaluateDiscordHelp] helper:", helper.username, "| beneficiary:", beneficiary.username);

  const contextLines = messages
    .map((m) => `[${m.author_username}] ${m.content}`)
    .join("\n");

  const shortContent = (messages[messages.length - 1]?.content ?? "Discord contribution")
    .replace(/\s+/g, " ").trim().slice(0, 60);

  const description = [
    `Interaction d'entraide Discord`,
    `Helper: ${helper.username} | Bénéficiaire: ${beneficiary.username}`,
    ``,
    `Contexte de la conversation (${messages.length} messages) :`,
    contextLines,
  ].join("\n");

  // Construit la liste des critères avec poids pour le prompt
  const criteriaList = discordHelpGrid.categories.flatMap(cat =>
    cat.subcriteria.map(sub => ({
      criterion: sub.criterion,
      weight: cat.weight / cat.subcriteria.length,
    }))
  );

  const criteriaDescription = discordHelpGrid.categories
    .map(cat =>
      `- ${cat.category} (${Math.round(cat.weight * 100)}%) :\n` +
      cat.subcriteria.map(sub => `    * ${sub.criterion}: ${sub.description}`).join("\n")
    ).join("\n\n");

  const prompt = `${discordHelpGrid.instructions}

CRITÈRES D'ÉVALUATION :
${criteriaDescription}

CONVERSATION À ÉVALUER :
${description}

IMPORTANT : Retourne UNIQUEMENT un objet JSON valide.
Attribue un score honnête (0-9) par critère en fonction du contenu réel de la conversation.
N'attribue PAS des 0 globaux si la conversation montre une aide — score chaque critère séparément.
La décision de seuil est gérée par le système, pas par toi.

{
  "scores": [
    {"criterion": "nom_critère", "score": 0-9, "comment": "justification courte"},
    ...
  ]
}
Tu dois fournir exactement ${criteriaList.length} scores, un par critère dans l'ordre donné.`;

  const client = new OpenAI({ apiKey: config.openai.apiKey });

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0,
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  console.log("[evaluateDiscordHelp] OpenAI raw response:", raw);
  const parsed = JSON.parse(raw) as { scores: CriterionScore[] };

  const scores: CriterionScore[] = (parsed.scores ?? []).map((s, i) => ({
    ...s,
    weight: criteriaList[i]?.weight ?? 0,
  }));

  const globalScore = scores.reduce((acc, s) => acc + s.score * s.weight, 0);
  const globalScore100 = Math.round((globalScore / 9) * 100);
  const justification = scores
    .map(s => `${s.criterion} (${s.score}/9): ${s.comment ?? ""}`)
    .join(". ");

  const title = `Discord help: ${shortContent || "message"}`;

  if (globalScore < SKIP_THRESHOLD) {
    return {
      title,
      description,
      tags: ["discord", "entraide"],
      evaluation: { globalScore: globalScore100, scores, justification },
      skipped: true,
      skip_reason: `Score insuffisant (${globalScore.toFixed(2)}/9, seuil: ${SKIP_THRESHOLD}/9)`,
    };
  }

  return {
    title,
    description,
    tags: ["discord", "entraide"],
    evaluation: { globalScore: globalScore100, scores, justification },
    skipped: false,
  };
}