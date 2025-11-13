import { Router, Request, Response } from "express";
import { ContributionRepository } from "../../database-service/repositories/index.js";
import { asyncHandler } from "../middleware/async-handler.js";

const router = Router();
const repo = new ContributionRepository();

// GET /api/contributions - Liste toutes les contributions
router.get("/", asyncHandler(async (req: Request, res: Response) => {
  const contributions = await repo.findAll();
  res.json(contributions);
}));

// GET /api/contributions/:id - Détails d'une contribution
router.get("/:id", asyncHandler(async (req: Request, res: Response) => {
  const contribution = await repo.findById(req.params.id);
  if (!contribution) {
    return res.status(404).json({ error: "Contribution not found" });
  }
  res.json(contribution);
}));

// GET /api/contributions/user/:userId - Contributions d'un user
router.get("/user/:userId", asyncHandler(async (req: Request, res: Response) => {
  const contributions = await repo.findByUser(req.params.userId);
  res.json(contributions);
}));

// GET /api/contributions/challenge/:challengeId - Contributions d'un challenge
router.get("/challenge/:challengeId", asyncHandler(async (req: Request, res: Response) => {
  const contributions = await repo.findByChallenge(req.params.challengeId);
  res.json(contributions);
}));

// POST /api/contributions - Créer une contribution
router.post("/", asyncHandler(async (req: Request, res: Response) => {
  const contribution = await repo.create(req.body);
  res.status(201).json(contribution);
}));

// PUT /api/contributions/:id - Modifier une contribution
router.put("/:id", asyncHandler(async (req: Request, res: Response) => {
  const contribution = await repo.update(req.params.id, req.body);
  res.json(contribution);
}));

// DELETE /api/contributions/:id - Supprimer une contribution
router.delete("/:id", asyncHandler(async (req: Request, res: Response) => {
  await repo.delete(req.params.id);
  res.status(204).send();
}));

export default router;
