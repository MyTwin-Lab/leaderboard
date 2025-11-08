import dotenv from "dotenv";
dotenv.config();

import OpenAI from "openai";
import { Contribution } from "../types.js";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function runIdentifyAgent(context: any): Promise<Contribution[]> {
    const { roadmap, ...otherContext } = context;
    
    const prompt = `
        Tu es un fin manager qui suit son équipe et leurs contributions à des challenge variés.
        Analyse le texte suivant qui comprends un résumé de réunion de synchronisation avec l'équipe (sur lequel tu te bases pour identifier les contributions), 
        une liste de commits sur le repository Github correspondant au projet ainsi que les membres de l'équipe.

        Pour définir les contributions: 
        - si certaines sont en doubles tu dois en produire une seule

        Renvoie un tableau JSON de contributions bien divisées (tout type de contribution) au format :
        [
            { "title": "...", "type": "...", "description": "... roadmap step : ...", "tags": ["..."], "userId": "...", "commitSha": "..." }
        ]
        type peut etre "code", "model", "dataset" ou "docs" seulement.
        les tags peuvent etre des technos (exemple "NextJS", "MONAI", "PgSQL", etc..)

        Si la contribution est simple : update readme, micro fix, ne la compte pas.

        TU ES OBLIGE DE LIER UNE CONTRIBUTION A UN COMMIT
        CONTEXTE:
        ${typeof otherContext === "string" ? otherContext : JSON.stringify(otherContext)}

        ${roadmap ? `
        Tu dois prendre en compte la roadmap suivante car chaque contribution doit être reliée obligatoirement à une étape de la roadmap :

        ROADMAP:
        ${roadmap}
        ` : ''}
    `;

    const response = await client.responses.create({
        model: "gpt-5-nano", // ou "gpt-4o-mini"
        input: prompt,
    });

    // Selon le modèle, tu peux extraire le JSON directement :
    const text = response.output_text;
    return JSON.parse(text);
}
