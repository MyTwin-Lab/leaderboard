/**
 * Contrat d'interface entre l'API (Dev) et l'orchestrateur Discord (Data IA).
 *
 * L'orchestrateur reçoit les messages de la conversation et retourne un objet
 * Contribution structuré avec son scoring d'évaluation.
 *
 * Point de branchement Data IA : implémenter `evaluateDiscordHelp()` (tâche 4.2).
 * La grille d'évaluation est dans `packages/evaluator/grids/discord_help.grid.ts` (tâche 4.3).
 */

import type { DiscordMessageItem } from "../../connectors/implementation/Discord.connector.js";
import type { CriterionScore } from "../types.js";

// --- TYPES ---

export interface DiscordEvaluationInput {
  messages: DiscordMessageItem[];
  helper: { discord_id: string; username: string };
  beneficiary: { discord_id: string; username: string };
}

/**
 * Objet Contribution retourné par l'orchestrateur LLM.
 * Prêt à être inséré dans la table `contributions` (type: "discord_help").
 *
 * `user_id` et `reward` sont ajoutés côté API (user_id via discord_accounts,
 * reward calculé depuis evaluation.globalScore).
 */
export interface DiscordContributionOutput {
  title: string;                // Résumé de l'aide apportée — ex: "Aide au débogage d'une boucle Python"
  description: string;          // Synthèse de l'échange et de la qualité de l'aide
  tags?: string[];              // Domaines concernés — ex: ["python", "débogage"]
  evaluation: {
    globalScore: number;        // 0–100 — score global pondéré
    scores: CriterionScore[];   // Score par critère de la grille discord_help
    justification: string;      // Explication textuelle du score global
  };
  skipped: boolean;
  skip_reason?: string;         // Raison si skipped: true
}

// --- STUB (à remplacer par Data IA) ---

/**
 * Évalue la qualité d'une interaction d'entraide Discord.
 * Utilise la grille `discord_help` et le prompt système défini en tâche 4.1.
 *
 * TODO (Data IA — tâche 4.2) : Remplacer ce stub par l'appel à l'orchestrateur LLM.
 *
 * @example
 * const result = await evaluateDiscordHelp({ messages, helper, beneficiary });
 * if (!result.skipped) {
 *   console.log(result.evaluation.globalScore); // 0–100
 *   console.log(result.title);                  // "Aide au débogage Python"
 * }
 */
export async function evaluateDiscordHelp(
  _input: DiscordEvaluationInput
): Promise<DiscordContributionOutput> {
  throw new Error(
    "[evaluateDiscordHelp] Non implémenté — à brancher par les Data IA (tâche 4.2). " +
    "Voir packages/evaluator/grids/discord_help.grid.ts pour la grille d'évaluation."
  );
}
