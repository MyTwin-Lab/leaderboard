import { config } from "../../config/index.js";
import OpenAI from "openai";
import { IdentifyContext, Contribution } from "../types.js";

const client = new OpenAI({ apiKey: config.openai.apiKey });

export async function runIdentifyAgent(context: IdentifyContext): Promise<Contribution[]> {
    const { roadmap, ...otherContext } = context;
    
    const prompt = `
        TACHE:
        Tu es un fin manager qui suit son équipe et leurs contributions à des challenge variés.
        Analyse le texte suivant qui comprends un résumé de réunion de synchronisation avec l'équipe (sur lequel tu te bases pour identifier les contributions), 
        une liste de commits sur le repository distant correspondant au projet ainsi que les membres de l'équipe.

        Pour définir les contributions:
        - Si la contribution est simple : update readme minimale, micro fix, ne la compte pas.
        - Les contributions d'une même sous étape de la roadmap doivent être comptées comme une seule contribution.
        Attention : Il faut différencier Etape et Sous étape de la roadmap.

        TU as obligation de relier une contribution à une seule sous étape de la roadmap, dont tu dois recopier le nom exact dans la description, en plus de la description de la contribution.

        Renvoie un tableau JSON de contributions bien divisées (tout type de contribution) au format :
        [
            {
                "title": "...",
                "type": "...",
                "description": "... roadmap step : ...",
                "tags": ["..."],
                "userId": "...",
                "commitShas": ["sha_plus_ancien", "sha_plus_recent"]
            }
        ]
        - Les commitShas doivent lister les commits pertinents pour la contribution SI et SEULEMENT SI il s'agit de la même SOUS ETAPE de roadmap, classés du plus ancien au plus récent.
        - type peut etre "code", "model (de ML ou IA)" ou "dataset" seulement, si des contributions sont liés à d'autres aspects ne les comptent pas.
        - les tags peuvent etre des technos (exemple "NextJS", "MONAI", "PgSQL", etc..)

        CONTEXTE:
        ${typeof otherContext === "string" ? otherContext : JSON.stringify(otherContext)}

        ${roadmap ? `
        Tu dois prendre en compte la roadmap suivante car chaque contribution doit être reliée obligatoirement à une SEULE sous-étape de la roadmap, pas plusieurs :
        Par contre une sous-étape de la roadmap peut etre sur plusieurs contributions.

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
