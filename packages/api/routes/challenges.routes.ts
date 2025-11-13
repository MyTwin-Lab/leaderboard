import { Router, Request, Response } from "express";
import { ChallengeService } from "../../services/challenge.service.js";
import { ChallengeRepository, ChallengeTeamRepository } from "../../database-service/repositories/index.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { requireAdmin } from "../middleware/auth.js";

const router = Router();
const service = new ChallengeService();
const repo = new ChallengeRepository();
const teamRepo = new ChallengeTeamRepository();

// GET /api/challenges - Liste tous les challenges
router.get("/", asyncHandler(async (req: Request, res: Response) => {
  const challenges = await repo.findAll();
  res.json(challenges);
}));

// GET /api/challenges/:id - Détails d'un challenge
router.get("/:id", asyncHandler(async (req: Request, res: Response) => {
  const challenge = await repo.findById(req.params.id);
  if (!challenge) {
    return res.status(404).json({ error: "Challenge not found" });
  }
  res.json(challenge);
}));

// GET /api/challenges/:id/context - Contexte complet (repos, team, contributions)
router.get("/:id/context", asyncHandler(async (req: Request, res: Response) => {
  const context = await service.getChallengeContext(req.params.id);
  res.json(context);
}));

// POST /api/challenges - Créer un challenge (ADMIN ONLY)
router.post("/", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const challenge = await repo.create(req.body);
  res.status(201).json(challenge);
}));

// PUT /api/challenges/:id - Modifier un challenge (ADMIN ONLY)
router.put("/:id", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const challenge = await repo.update(req.params.id, req.body);
  res.json(challenge);
}));

// DELETE /api/challenges/:id - Supprimer un challenge (ADMIN ONLY)
router.delete("/:id", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  await repo.delete(req.params.id);
  res.status(204).send();
}));

// POST /api/challenges/:id/sync - Lancer une évaluation Sync Meeting (ADMIN ONLY)
router.post("/:id/sync", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const evaluations = await service.runSyncEvaluation(req.params.id);
  res.json({ 
    success: true, 
    count: evaluations.length,
    evaluations 
  });
}));

// POST /api/challenges/:id/close - Clôturer et distribuer les rewards (ADMIN ONLY)
router.post("/:id/close", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const rewards = await service.computeChallengeRewards(req.params.id);
  await repo.update(req.params.id, { status: "completed" });
  res.json({ 
    success: true, 
    count: rewards.length,
    rewards 
  });
}));

// GET /api/challenges/:id/team - Liste les membres de l'équipe d'un challenge
router.get("/:id/team", asyncHandler(async (req: Request, res: Response) => {
  const members = await teamRepo.findTeamMembers(req.params.id);
  res.json(members);
}));

// POST /api/challenges/:id/team - Ajouter un membre à l'équipe (ADMIN ONLY)
router.post("/:id/team", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { user_id } = req.body;
  if (!user_id) {
    return res.status(400).json({ error: "user_id is required" });
  }
  const member = await teamRepo.create({
    challenge_id: req.params.id,
    user_id
  });
  res.status(201).json(member);
}));

// DELETE /api/challenges/:id/team/:userId - Retirer un membre de l'équipe (ADMIN ONLY)
router.delete("/:id/team/:userId", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  await teamRepo.delete(req.params.id, req.params.userId);
  res.status(204).send();
}));

export default router;
