/**
 * Seed script: cast 3 verdicts on the "Validation Mammo class" challenge
 * via ValidationChallengeService (so CP distribution runs normally).
 *
 * Verdicts: Lucas → works, Emma → works, Théo → broken
 * With required_validations=3 this resolves immediately (majority: works).
 *
 * Run: npx tsx db_data/seed-validation-mammo.ts
 */
import { ValidationChallengeService } from '../packages/services/challenge/validation-challenge.service.js';

const CHALLENGE_ID   = '81c5b3a8-7ff9-49cd-8ad1-9f8c26bbd2a9';
const CONTRIBUTION_ID = 'a2cd57c7-3522-44fb-af89-6566b44fc926';

const verdicts = [
  { userId: 'db52d3a4-08f8-4a37-8c8b-2fb16b2d358f', name: 'Lucas Nguyen',   verdict: 'works'  as const, description: null },
  { userId: '10fe958c-86dc-481c-9e00-a49c6b14f2ea', name: 'Emma Rousseau',  verdict: 'works'  as const, description: null },
  { userId: '76f3c725-773b-4f13-b55e-3be1a453b430', name: 'Théo Bernard',   verdict: 'broken' as const, description: "Le modèle retourne une erreur 500 sur les images en niveaux de gris." },
];

const service = new ValidationChallengeService();

for (const v of verdicts) {
  try {
    const result = await service.castVerdict({
      validationChallengeId: CHALLENGE_ID,
      contributionId: CONTRIBUTION_ID,
      validatorUserId: v.userId,
      verdict: v.verdict,
      description: v.description,
    });
    console.log(`✅ ${v.name} (${v.verdict}): resolved=${result.resolved}, outcome=${result.outcome}, cpAwarded=${result.cpAwarded}`);
  } catch (e: any) {
    console.error(`❌ ${v.name}: ${e.message}`);
  }
}
