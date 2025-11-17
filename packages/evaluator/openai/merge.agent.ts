import dotenv from "dotenv";
dotenv.config();

import OpenAI from "openai";
import { Contribution, ToMergeContribution } from "../types.js";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function runMergeAgent(newContributions: Contribution[], oldContributions: any): Promise<ToMergeContribution[]> {
    const prompt = `
        ROLE :
        Tu es l’agent « ContributionMergeEvaluator » du système MyTwin Leaderboard.
        Ton objectif est d’analyser des contributions récentes identifiées par un autre agent,
        et de déterminer pour chacune d’entre elles si elle doit être fusionnée avec une contribution 
        existante, ou considérée comme une nouvelle contribution distincte.

        CONTEXTE :
        Le système stocke des contributions (code, modèles, datasets, documentation).
        À chaque mise à jour d’un dépôt (ou autre source), les nouvelles contributions sont extraites 
        automatiquement.

        Tu reçois :
        une liste de contributions déjà existantes dans la base
        une liste de nouvelles contributions à traiter

        Chaque contribution appartient à un seul utilisateur.

        Entrées

        Tu reçois deux tableaux :
        oldContributions (proviennent de la base de donnée)
        newContributions (proviennent de l'agent d'identification en amont)

        Chaque nouvelle contribution contient au minimum :
        {
            "title": "...",
            "type": "code | dataset | model | doc",
            "description": "...",
            "tags": [...],
            "userId": "..."
        }
        Tu as aussi l'étape de la roadmap dans laquelle la contribution a été identifiée dans sa description.

        Old contributions :
        ${typeof oldContributions === "string" ? oldContributions : JSON.stringify(oldContributions)}
        New contributions :
        ${typeof newContributions === "string" ? newContributions : JSON.stringify(newContributions)}

        OBJECTIF :
        Pour chaque nouvelle contribution, tu dois déterminer :
        si elle correspond à une mise à jour ou à une extension logique d’une contribution existante 
        du même utilisateur ou si elle doit être considérée comme une contribution nouvelle
        Dans le cas d’une correspondance, tu identifies précisément l’ancienne contribution (par son id).

        Règles de décision
        Une nouvelle contribution doit être fusionnée avec une contribution existante si 
        plusieurs de ces éléments sont vrais :
        - même utilisateur (doit toujours etre vrai)
        - même fichier ou même dossier dans le dépôt
        - même logique fonctionnelle ou continuité thématique
        - des titres ou descriptions qui s’enchaînent (ex : amélioration, correctif, ajout de tests, v2, optimisation, suite d’un travail précédent)
        - proximité forte entre embeddings ou contenu textuel
        - commits proches dans le temps liés au même élément technique

        Pour une contribution qui doit etre fusionnée, tu dois retravailler son titre et sa description 
        pour refléter la fusion des deux contributions.

        Une contribution est considérée comme nouvelle si :
        - le sujet est différent
        - le fichier ou dossier est distinct
        - l’intention n’a aucun lien avec les anciennes contributions du même utilisateur
        - la similarité sémantique est faible
        - c’est une unité fonctionnelle nouvelle

        SORTIE :
        Tu produis un JSON de la forme suivante :
        [
            {
                "contribution": {
                "title": "...",
                "type": "...",
                "description": "...",
                "tags": ["..."],
                "userId": "...",
                "commitShas": ["sha_plus_ancien", "sha_plus_recent"]
                },
                "oldContributionId": "..."
            }
        ]
    `;

    const response = await client.responses.create({
        model: "gpt-5-nano", // ou "gpt-4o-mini"
        input: prompt,
    });

    // Selon le modèle, tu peux extraire le JSON directement :
    const text = response.output_text;
    return JSON.parse(text);
}
