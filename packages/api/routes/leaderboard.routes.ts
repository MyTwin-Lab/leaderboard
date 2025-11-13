import { Router, Request, Response } from "express";
import { ContributionRepository, ChallengeRepository } from "../../database-service/repositories/index.js";
import { asyncHandler } from "../middleware/async-handler.js";

const router = Router();
const contributionRepo = new ContributionRepository();
const challengeRepo = new ChallengeRepository();

// GET /api/leaderboard - Leaderboard global (toutes contributions)
router.get("/", asyncHandler(async (req: Request, res: Response) => {
  const contributions = await contributionRepo.findAll();
  
  // Trier par reward décroissant
  const leaderboard = contributions
    .filter(c => c.reward > 0)
    .sort((a, b) => b.reward - a.reward);
  
  res.json(leaderboard);
}));

// GET /api/leaderboard/challenge/:challengeId - Leaderboard d'un challenge
router.get("/challenge/:challengeId", asyncHandler(async (req: Request, res: Response) => {
  const contributions = await contributionRepo.findByChallenge(req.params.challengeId);
  
  // Trier par reward décroissant
  const leaderboard = contributions
    .filter(c => c.reward > 0)
    .sort((a, b) => b.reward - a.reward);
  
  res.json(leaderboard);
}));

// GET /api/leaderboard/challenge/:challengeId/stats - Stats d'un challenge
router.get("/challenge/:challengeId/stats", asyncHandler(async (req: Request, res: Response) => {
  const challenge = await challengeRepo.findById(req.params.challengeId);
  const contributions = await contributionRepo.findByChallenge(req.params.challengeId);
  
  const totalRewardsDistributed = contributions.reduce((sum, c) => sum + c.reward, 0);
  const avgScore = contributions.length > 0
    ? contributions.reduce((sum, c) => sum + ((c.evaluation as any)?.globalScore || 0), 0) / contributions.length
    : 0;
  
  res.json({
    challenge: {
      id: challenge?.uuid,
      title: challenge?.title,
      totalPool: challenge?.contribution_points_reward,
    },
    stats: {
      totalContributions: contributions.length,
      totalRewardsDistributed,
      remainingPool: (challenge?.contribution_points_reward || 0) - totalRewardsDistributed,
      averageScore: Math.round(avgScore * 100) / 100,
    },
  });
}));

export default router;
