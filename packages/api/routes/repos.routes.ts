import { Router, Request, Response } from "express";
import { RepoRepository, ChallengeRepoRepository } from "../../database-service/repositories/index.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { requireAdmin } from "../middleware/auth.js";

const router = Router();
const repo = new RepoRepository();
const challengeRepoRepo = new ChallengeRepoRepository();

// GET /api/repos - Liste tous les repos
router.get("/", asyncHandler(async (req: Request, res: Response) => {
  const repos = await repo.findAll();
  res.json(repos);
}));

// GET /api/repos/:id - Détails d'un repo
router.get("/:id", asyncHandler(async (req: Request, res: Response) => {
  const repository = await repo.findById(req.params.id);
  if (!repository) {
    return res.status(404).json({ error: "Repository not found" });
  }
  res.json(repository);
}));

// POST /api/repos - Créer un repo (ADMIN ONLY)
router.post("/", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const repository = await repo.create(req.body);
  res.status(201).json(repository);
}));

// PUT /api/repos/:id - Modifier un repo (ADMIN ONLY)
router.put("/:id", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const repository = await repo.update(req.params.id, req.body);
  res.json(repository);
}));

// DELETE /api/repos/:id - Supprimer un repo (ADMIN ONLY)
router.delete("/:id", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  await repo.delete(req.params.id);
  res.status(204).send();
}));

// POST /api/challenge-repos - Lier un repo à un challenge (ADMIN ONLY)
router.post("/challenge-repos", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const link = await challengeRepoRepo.create(req.body);
  res.status(201).json(link);
}));

export default router;
