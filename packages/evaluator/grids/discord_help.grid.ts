/**
 * Grille d'évaluation — contributions Discord d'entraide
 *
 * TODO (Data IA — tâche 4.3) : Affiner les poids, critères et guides de scoring
 * avec l'équipe avant la séance 8. Cette grille est un point de départ.
 */

import { DetailedEvaluationGridTemplate } from './index.js';

export const discordHelpGrid: DetailedEvaluationGridTemplate = {
  type: "discord_help",
  categories: [
    {
      category: "Pertinence de la réponse",
      weight: 0.30,
      type: "contextual",
      subcriteria: [
        {
          criterion: "Adéquation au problème posé",
          description: "La réponse traite effectivement la question ou le problème du bénéficiaire",
          indicators: [
            "La réponse répond à la question initiale",
            "Le helper a compris le contexte du problème",
            "Pas de réponse hors sujet ou générique"
          ],
          scoringGuide: {
            excellent: "8-9: Réponse ciblée, comprend les nuances du problème",
            good: "5-7: Répond au problème principal avec légères approximations",
            average: "2-4: Réponse partiellement adaptée ou trop générale",
            poor: "0-1: Hors sujet ou ne répond pas au problème"
          }
        }
      ]
    },
    {
      category: "Clarté et pédagogie",
      weight: 0.25,
      type: "subjective",
      subcriteria: [
        {
          criterion: "Clarté de l'explication",
          description: "La réponse est compréhensible et bien structurée",
          indicators: [
            "Explication progressive et logique",
            "Utilisation d'exemples concrets si pertinent",
            "Langage adapté au niveau apparent du bénéficiaire"
          ],
          scoringGuide: {
            excellent: "8-9: Explication claire, structurée, avec exemples pertinents",
            good: "5-7: Compréhensible avec effort minimal",
            average: "2-4: Partiellement clair, nécessite des clarifications",
            poor: "0-1: Confus ou incompréhensible"
          }
        }
      ]
    },
    {
      category: "Complétude",
      weight: 0.25,
      type: "mixed",
      subcriteria: [
        {
          criterion: "Exhaustivité de la réponse",
          description: "Le problème est résolu ou suffisamment adressé",
          indicators: [
            "Toutes les facettes du problème sont traitées",
            "Les cas limites importants sont mentionnés",
            "La solution est actionnable par le bénéficiaire"
          ],
          scoringGuide: {
            excellent: "8-9: Réponse complète, solution directement applicable",
            good: "5-7: Couvre l'essentiel, quelques points secondaires manquants",
            average: "2-4: Réponse partielle, travail supplémentaire requis",
            poor: "0-1: Réponse incomplète ou inapplicable"
          }
        }
      ]
    },
    {
      category: "Qualité de l'échange",
      weight: 0.20,
      type: "subjective",
      subcriteria: [
        {
          criterion: "Engagement et suivi",
          description: "Le helper a suivi l'échange et adapté ses réponses",
          indicators: [
            "Réponse aux questions de suivi",
            "Adaptation si la première réponse n'était pas suffisante",
            "Ton constructif et bienveillant"
          ],
          scoringGuide: {
            excellent: "8-9: Échange complet, helper disponible et adaptatif",
            good: "5-7: Bonne interaction, quelques points de suivi",
            average: "2-4: Engagement limité, réponses sèches",
            poor: "0-1: Pas d'engagement ou ton inapproprié"
          }
        }
      ]
    }
  ],

  instructions: `
## Instructions d'évaluation — Entraide Discord

### Contexte
Tu évalues la qualité d'une aide apportée par un membre Discord (le helper) à un autre membre (le bénéficiaire).
Les messages fournis sont les échanges précédant la réaction emoji de remerciement.

### 1. SCORING PAR CRITÈRE
Pour chaque sous-critère :
1. Lire les messages dans leur ordre chronologique
2. Identifier les échanges pertinents au critère
3. Attribuer un score 0-9 selon le scoringGuide
4. **Justifier avec des extraits concrets des messages**

### 2. CAS DE SKIP — retourner skipped: true si :
- La conversation est trop courte (< 3 messages)
- L'emoji semble accidentel (pas de lien avec une demande d'aide)
- Le helper et le bénéficiaire sont la même personne
- Le contenu est non évaluable (images uniquement, langue non reconnue)

### 3. CALIBRATION
- **8-9** : Aide exemplaire, à mettre en valeur
- **5-7** : Aide utile et correcte
- **2-4** : Aide partielle ou maladroite mais de bonne foi
- **0-1** : Pas d'aide réelle ou aide contre-productive

### 4. OUTPUT ATTENDU
Retourner un objet Contribution JSON avec :
- title : résumé de l'aide apportée (1 ligne)
- description : synthèse de l'échange et de la qualité de l'aide
- tags : mots-clés du domaine aidé (ex: ["python", "débogage", "boucles"])
- evaluation : { globalScore, scores: [...], justification }
  `.trim()
};
