import OpenAI from "openai";
import { Contribution, Evaluation } from "../types.js";
import { EvaluationGridTemplate } from "../grids/index.js";
import fs from "fs/promises";
import path from "path";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// Helper pour vérifier si la réponse contient des tool calls
function hasToolCalls(response: OpenAI.Responses.Response): boolean {
  return response.output.some(
    (item) => item.type === "function_call"
  );
}

// Helper pour extraire les tool calls de la réponse
function extractToolCalls(response: OpenAI.Responses.Response): Array<{
  id: string;
  call_id: string;
  name: string;
  arguments: string;
}> {
  const toolCalls: Array<{ id: string; call_id: string; name: string; arguments: string }> = [];
  
  for (const item of response.output) {
    if (item.type === "function_call") {
      toolCalls.push({
        id: item.id || item.call_id,
        call_id: item.call_id,
        name: item.name,
        arguments: item.arguments,
      });
    }
  }
  
  return toolCalls;
}

// Définit l’outil “read_file” en respectant le schéma attendu
const tools: OpenAI.Responses.Tool[] = [
  {
    type: "function",
    name: "read_file",
    description: "Lit un fichier texte dans le workspace temporaire du commit courant",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Chemin relatif du fichier à lire"
        }
      },
      required: ["path"]
    },
    strict: null,
  },
];

export async function runEvaluateAgent(
  contribution: Contribution, 
  context: { snapshot: any; grid: EvaluationGridTemplate }
): Promise<Evaluation> {
  const { snapshot, grid } = context;
  const workspace = snapshot.workspacePath;

  const criteriaDescription = grid.criteriaTemplate
    .map(c => `- ${c.criterion}`)
    .join('\n');

  const prompt = `
    ${grid.instructions}
    
    CRITÈRES D'ÉVALUATION:
    ${criteriaDescription}
    
    CONTRIBUTION:
    ${JSON.stringify(contribution)}
    
    SNAPSHOT DU CODE:
    ${typeof snapshot === "string" ? snapshot : JSON.stringify(snapshot)}
    
    Utilise l'outil "read_file" pour lire les fichiers dont tu as besoin.
    Retourne un objet JSON de la forme :
    {
      "scores": [
        {"criterion": "nom_critère", "score": 0-100, "comment": "justification"},
        ...
      ]
    }
  `;

  let response = await client.responses.create({
    model: "gpt-5-nano",
    tools,
    tool_choice: "auto",
    input: prompt,
  });

  // Boucle de gestion des tool calls
  while (response.status === "incomplete" || hasToolCalls(response)) {
    const toolCalls = extractToolCalls(response);
    
    if (toolCalls.length === 0) {
      break;
    }

    // Exécute chaque tool call et prépare les outputs
    const outputs: any[] = [];
    
    for (const toolCall of toolCalls) {
      let output: string;
      
      if (toolCall.name === "read_file") {
        try {
          const args = JSON.parse(toolCall.arguments);
          const filePath = path.join(workspace, args.path);
          console.log("Lecture du fichier: ", filePath);
          const content = await fs.readFile(filePath, "utf-8");
          output = content;
        } catch (error) {
          output = `Erreur lors de la lecture du fichier: ${error instanceof Error ? error.message : String(error)}`;
        }
      } else {
        output = "Outil non existant";
      }

      // Ajoute seulement le function_call_output (le function_call est déjà dans previous_response)
      // Selon la doc officielle, pas besoin d'id lors de l'envoi
      outputs.push({
        type: "function_call_output",
        call_id: toolCall.call_id,
        output,
      });
    }

    // Continue la conversation avec les résultats des tool calls
    response = await client.responses.create({
      model: "gpt-5-nano",
      tools,
      tool_choice: "auto",
      previous_response_id: response.id,
      input: outputs,
    });
  }

  const text = response.output_text;
  const evaluation = JSON.parse(text) as Evaluation;

  const weightedScores = evaluation.scores.map((score) => {
    const weight = grid.criteriaTemplate.find(c => c.criterion === score.criterion)?.weight ?? 1;
    return { ...score, weight };
  });

  evaluation.scores = weightedScores;
  evaluation.globalScore = weightedScores.reduce(
    (acc, s) => acc + s.score * s.weight,
    0
  );
  return evaluation;
}
