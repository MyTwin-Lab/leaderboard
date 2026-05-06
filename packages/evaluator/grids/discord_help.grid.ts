import { DetailedEvaluationGridTemplate } from './index.js';

/**
 * Grille d'évaluation pour les contributions Discord de type "aide communautaire".
 *
 * Objectif : valoriser uniquement les aides réelles, uniques, et efficacement résolues.
 * Contre-mesures intégrées :
 *  - Détection des réponses triviales (< 30 mots, aucun exemple/lien/code)
 *  - Détection des doublons (même réponse déjà fournie dans le contexte)
 *  - Exigence de confirmation implicite ou explicite de résolution
 *  - Pénalisation des contributions répétitives sur le même problème
 */
export const discordHelpGrid: DetailedEvaluationGridTemplate = {
  type: "discord_help",

  categories: [

    // ─────────────────────────────────────────────────
    // 1. QUALITÉ INTRINSÈQUE DE LA RÉPONSE (30%)
    // ─────────────────────────────────────────────────
    {
      category: "Qualité intrinsèque de la réponse",
      weight: 0.30,
      type: "mixed",
      subcriteria: [
        {
          criterion: "Pertinence par rapport à la question",
          description: "La réponse adresse directement le problème posé, sans dériver sur un sujet non demandé",
          indicators: [
            "La réponse cible précisément la question ou l'erreur exprimée dans le contexte",
            "Pas de hors-sujet, de réponse générique copiée-collée ou de réponse à une autre question",
            "Les informations fournies sont directement applicables à la situation décrite",
            "Si plusieurs questions sont posées, toutes sont traitées ou le périmètre est clarifié"
          ],
          scoringGuide: {
            excellent: "8-9 : Réponse ciblée au problème exact, aucun écart de sujet",
            good: "5-7 : Adresse le problème principal avec quelques éléments périphériques",
            average: "2-4 : Partiellement hors sujet ou réponse trop générique",
            poor: "0-1 : Réponse non pertinente, question ignorée ou mal comprise"
          }
        },
        {
          criterion: "Clarté et lisibilité",
          description: "La réponse est structurée, bien rédigée et compréhensible sans effort excessif",
          indicators: [
            "Phrases courtes et logiques, vocabulaire adapté au niveau de l'interlocuteur",
            "Utilisation pertinente de mise en forme (code blocks, listes, gras) si le canal le permet",
            "Aucune ambiguïté dans les instructions ou étapes décrites",
            "Réponse d'au moins 30 mots significatifs (les réponses < 30 mots sans code ni lien ne peuvent dépasser 3/9)"
          ],
          scoringGuide: {
            excellent: "8-9 : Immédiatement compréhensible, structurée, vocabulaire précis",
            good: "5-7 : Claire avec effort minimal, légères imprécisions de formulation",
            average: "2-4 : Compréhensible mais dense ou mal organisée",
            poor: "0-1 : Confuse, trop courte pour être utile, ambiguë ou incompréhensible"
          }
        },
        {
          criterion: "Complétude de la réponse",
          description: "La réponse traite le problème de bout en bout sans laisser des étapes critiques manquantes",
          indicators: [
            "Toutes les étapes nécessaires à la résolution sont présentes",
            "Les cas limites évidents sont mentionnés si pertinents",
            "Si la réponse est partielle, c'est explicitement justifié (ex: 'pour la partie X, voir doc Y')",
            "Ne se contente pas d'un lien externe sans explication minimale"
          ],
          scoringGuide: {
            excellent: "8-9 : Solution complète, autonome, sans lacune critique",
            good: "5-7 : Couvre l'essentiel, quelques points secondaires omis",
            average: "2-4 : Incomplet mais apporte une piste utile",
            poor: "0-1 : Réponse tronquée, piste inexploitable, ou simple redirection sans valeur"
          }
        }
      ]
    },

    // ─────────────────────────────────────────────────
    // 2. PROFONDEUR ET EFFORT (20%)
    // ─────────────────────────────────────────────────
    {
      category: "Profondeur et effort fourni",
      weight: 0.20,
      type: "objective",
      subcriteria: [
        {
          criterion: "Niveau de détail technique",
          description: "La réponse va au-delà de la surface et démontre une compréhension réelle du problème",
          indicators: [
            "Explique le 'pourquoi' pas seulement le 'quoi' ou le 'comment'",
            "Fournit du code, des commandes ou des exemples concrets si applicable",
            "Mentionne les pièges courants liés au problème",
            "Propose une ou plusieurs alternatives si pertinent"
          ],
          scoringGuide: {
            excellent: "8-9 : Explication profonde, exemples concrets, pièges mentionnés",
            good: "5-7 : Bon niveau de détail, un exemple ou une alternative fournie",
            average: "2-4 : Superficiel mais correct, aucun exemple",
            poor: "0-1 : Réponse vague ou triviale sans profondeur"
          }
        },
        {
          criterion: "Effort de rédaction visible",
          description: "L'auteur a clairement investi du temps pour formuler une réponse soignée",
          indicators: [
            "La réponse est rédigée spécifiquement pour ce contexte, pas copiée-collée sans adaptation",
            "Présence de reformulation du problème avant la solution (montre la compréhension)",
            "Réponse personnalisée selon le niveau apparent de l'interlocuteur",
            "Absence de fautes grossières ou de réponse expédiée en 2 mots"
          ],
          scoringGuide: {
            excellent: "8-9 : Réponse clairement rédigée pour cette situation précise",
            good: "5-7 : Effort visible, légèrement générique",
            average: "2-4 : Peu d'effort apparent, réponse rapide",
            poor: "0-1 : Réponse expédiée, aucun effort de personnalisation"
          }
        }
      ]
    },

    // ─────────────────────────────────────────────────
    // 3. RÉSOLUTION EFFECTIVE DU PROBLÈME (25%)
    // ─────────────────────────────────────────────────
    {
      category: "Résolution effective du problème",
      weight: 0.25,
      type: "contextual",
      subcriteria: [
        {
          criterion: "Confirmation de résolution dans le contexte",
          description: "Le contexte conversationnel indique que le problème a bien été résolu grâce à cette aide",
          indicators: [
            "L'auteur du message aidé confirme explicitement (ex: 'ça marche', 'merci ça a résolu', 'parfait')",
            "La réaction de remerciement 👍/❤️/🙏 est postérieure à la réponse et non automatique",
            "Aucune question de suivi non répondue du même type dans le contexte après la réponse",
            "Pas de message montrant que la solution n'a pas fonctionné sans réponse corrective"
          ],
          scoringGuide: {
            excellent: "8-9 : Confirmation explicite de résolution, fin naturelle du fil",
            good: "5-7 : Confirmation implicite (silence après la réponse, pas de relance)",
            average: "2-4 : Résolution probable mais non confirmée",
            poor: "0-1 : Problème non résolu visible dans le contexte, ou solution ignorée"
          }
        },
        {
          criterion: "Causalité aide → résolution",
          description: "C'est bien CETTE réponse qui a contribué à résoudre le problème, pas une autre",
          indicators: [
            "La réaction de remerciement cible spécifiquement le message évalué",
            "Pas d'autre réponse plus complète fournie par un tiers entre la réponse et la réaction",
            "Le contexte avant la réponse montrait un problème non résolu",
            "Le contexte après la réponse ne montre pas une solution provenant d'une autre source"
          ],
          scoringGuide: {
            excellent: "8-9 : Causalité claire et directe entre la réponse et la résolution",
            good: "5-7 : Contribution probable à la résolution, quelques incertitudes",
            average: "2-4 : Contribution marginale ou partagée avec d'autres réponses",
            poor: "0-1 : La résolution est due à une autre source, ou pas de résolution du tout"
          }
        }
      ]
    },

    // ─────────────────────────────────────────────────
    // 4. UNICITÉ ET NON-REDONDANCE (15%)
    // ─────────────────────────────────────────────────
    {
      category: "Unicité et non-redondance",
      weight: 0.15,
      type: "objective",
      subcriteria: [
        {
          criterion: "Absence de doublon dans le contexte",
          description: "La contribution n'est pas une répétition d'une réponse déjà apportée dans la même conversation",
          indicators: [
            "Aucun autre message dans le contexte ne fournit déjà la même solution ou la même information",
            "Si une réponse similaire existe, celle-ci apporte une valeur ajoutée distincte (ex: exemple différent, explication complémentaire)",
            "L'auteur n'a pas déjà reçu de points de contribution pour le même problème dans ce même fil",
            "Le message n'est pas une simple reformulation d'une réponse précédente du même auteur"
          ],
          scoringGuide: {
            excellent: "8-9 : Réponse unique, aucun doublon détectable dans le contexte",
            good: "5-7 : Légère redondance mais apporte un angle complémentaire",
            average: "2-4 : Redondante avec une réponse existante, valeur ajoutée faible",
            poor: "0-1 : Copie ou reformulation directe d'une réponse déjà présente dans le fil"
          }
        },
        {
          criterion: "Originalité de la contribution",
          description: "La réponse apporte quelque chose que les autres participants n'ont pas dit",
          indicators: [
            "Angle d'approche différent des autres réponses dans le contexte",
            "Information nouvelle, non mentionnée précédemment dans la conversation",
            "Pas un simple '+1' ou 'je confirme ce que X a dit' sans substance additionnelle",
            "Ne se contente pas de renvoyer vers une documentation sans ajout personnel"
          ],
          scoringGuide: {
            excellent: "8-9 : Apport original, perspective nouvelle et pertinente",
            good: "5-7 : Quelques éléments nouveaux malgré un fond similaire",
            average: "2-4 : Peu d'originalité, proche de ce qui existait déjà",
            poor: "0-1 : Aucun apport original, simple écho ou validation sans valeur"
          }
        }
      ]
    },

    // ─────────────────────────────────────────────────
    // 5. VALEUR COMMUNAUTAIRE ET RÉUTILISABILITÉ (10%)
    // ─────────────────────────────────────────────────
    {
      category: "Valeur communautaire et réutilisabilité",
      weight: 0.10,
      type: "contextual",
      subcriteria: [
        {
          criterion: "Portée au-delà du cas individuel",
          description: "La réponse peut bénéficier à d'autres membres de la communauté qui rencontrent le même problème",
          indicators: [
            "La réponse est formulée de manière à être compréhensible hors contexte immédiat",
            "La solution décrit un principe général, pas seulement un fix ponctuel et non transférable",
            "Utilisable comme référence future (pinnable, archivable, recherchable)",
            "Ne contient pas d'informations personnelles ou de contexte ultra-spécifique non généralisable"
          ],
          scoringGuide: {
            excellent: "8-9 : Réponse référenceable, utile pour la communauté entière",
            good: "5-7 : Utile au-delà du cas immédiat avec peu d'adaptation",
            average: "2-4 : Utile principalement pour le demandeur, difficilement transposable",
            poor: "0-1 : Réponse ultra-contextuelle sans valeur communautaire"
          }
        }
      ]
    }

  ],

  instructions: `
## Instructions d'évaluation — Grille discord_help

### CONTEXTE D'USAGE
Cette grille évalue des messages Discord ayant reçu une réaction de remerciement (👍, ❤️, 🙏).
L'objectif est de récompenser uniquement les aides **réelles**, **uniques** et **efficaces**.
L'agent doit être **strict** : le doute doit profiter au non-attribution de points, pas à l'auteur.

---

### RÈGLES ABSOLUES (seuils éliminatoires)

Ces règles s'appliquent AVANT tout scoring par critère.
Si l'une d'elles est déclenchée, les critères concernés sont scorés 0 automatiquement.

**R1 — Réponse triviale**
Si le message évalué fait moins de 30 mots ET ne contient ni code, ni lien, ni exemple concret :
→ Critères "Clarté" et "Profondeur" : score maximum 2/9.
→ Exemple de messages triviaux : "ok", "essaie ça", "regarde la doc", "ça marche pas chez moi non plus".

**R2 — Doublon détecté**
Si une réponse identique ou quasi-identique (même solution, mêmes étapes) existe déjà dans le contexte
AVANT le message évalué :
→ Critère "Absence de doublon" : score 0/9.
→ Critère "Originalité" : score 0-1/9.
→ Score global plafonné à 3/9 pondéré.

**R3 — Problème non résolu dans le contexte**
Si le contexte APRÈS la réponse montre que le problème persiste (questions de suivi sans réponse,
messages de frustration, "ça marche toujours pas") :
→ Critère "Confirmation de résolution" : score 0/9.
→ Critère "Causalité aide → résolution" : score 0-1/9.

**R4 — Auto-aide ou réaction circulaire**
Si l'auteur du message réactionné et l'auteur de la réaction sont la même personne
(normalement filtré par le bot, mais à vérifier dans le contexte) :
→ Score global : 0/9 sur tous les critères.

**R5 — Réponse hors sujet**
Si la réponse ne traite pas du problème posé dans le contexte précédant le message :
→ Critère "Pertinence" : score 0/9.
→ Score global plafonné à 2/9 pondéré.

---

### PROCESSUS D'ÉVALUATION

**Étape 1 — Lire le contexte complet**
Identifier :
- La question ou le problème posé (messages AVANT la réponse évaluée)
- La réponse évaluée
- La suite de la conversation (messages APRÈS) pour détecter la résolution ou non

**Étape 2 — Vérifier les règles absolues (R1 à R5)**
Appliquer les seuils éliminatoires avant tout scoring.

**Étape 3 — Scorer chaque critère (0-9)**
Pour chaque sous-critère :
1. Identifier les indicateurs applicables
2. Comparer avec le scoringGuide
3. Attribuer un score et une justification factuelle basée sur le texte du contexte
4. NE PAS supposer ce qu'on ne peut pas lire — si l'information manque, noter "contexte insuffisant" et appliquer un score médian ou bas selon l'impact

**Étape 4 — Calculer le score pondéré global**
Catégories et poids :
- Qualité intrinsèque de la réponse : 30%
- Profondeur et effort fourni : 20%
- Résolution effective du problème : 25%
- Unicité et non-redondance : 15%
- Valeur communautaire et réutilisabilité : 10%

**Étape 5 — Décision finale**
Seuil minimal pour attribution de points :
- Score pondéré global ≥ 4.0/9 requis pour toute attribution de points
- En dessous de 4.0 : contribution non éligible, score = 0

---

### CALIBRATION DES SCORES

- **8-9** : Aide exceptionnelle. Réponse complète, unique, confirmée résolue, valeur communautaire élevée.
- **5-7** : Bonne aide. Problème résolu, effort visible, pas de doublon majeur.
- **2-4** : Aide marginale. Partielle, redondante ou non confirmée. Points minimes ou nuls.
- **0-1** : Contribution invalide. Triviale, dupliquée, non pertinente ou problème non résolu.

---

### RECOMMANDATIONS POUR L'AGENT

- **Être factuel** : justifier chaque score avec une citation ou un élément du contexte.
- **Être strict sur les doublons** : si quelqu'un a déjà répondu la même chose 2 messages avant, c'est 0 sur l'unicité.
- **Ne pas récompenser la réaction seule** : une réaction 👍 ne prouve pas que c'est utile si le contexte montre le contraire.
- **Contextualiser la résolution** : chercher activement dans les messages APRÈS si le problème est clos.
- **Pénaliser les contributions en série** : si le même auteur a déjà reçu des points pour la même session de help sur le même problème, noter la redondance explicitement.
  `.trim()
};
