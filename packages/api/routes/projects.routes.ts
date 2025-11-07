import { Router, Request, Response } from "express";
import { ProjectRepository } from "../../database-service/repositories/index.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { requireAdmin } from "../middleware/auth.js";

const router = Router();
const repo = new ProjectRepository();

// GET /api/projects - Liste tous les projets
router.get("/", asyncHandler(async (req: Request, res: Response) => {
  const projects = await repo.findAll();
  res.json(projects);
}));

// GET /api/projects/:id - Détails d'un projet
router.get("/:id", asyncHandler(async (req: Request, res: Response) => {
  const project = await repo.findById(req.params.id);
  if (!project) {
    return res.status(404).json({ error: "Project not found" });
  }
  res.json(project);
}));

// GET /api/projects/:id/challenges - Challenges d'un projet
router.get("/:id/challenges", asyncHandler(async (req: Request, res: Response) => {
  const challenges = await repo.findWithChallenges(req.params.id);
  res.json(challenges);
}));

// GET /api/projects/:id/repos - Repos d'un projet
router.get("/:id/repos", asyncHandler(async (req: Request, res: Response) => {
  const repos = await repo.findWithRepos(req.params.id);
  res.json(repos);
}));

// POST /api/projects - Créer un projet (ADMIN ONLY)
router.post("/", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const project = await repo.create(req.body);
  res.status(201).json(project);
}));

// PUT /api/projects/:id - Modifier un projet (ADMIN ONLY)
router.put("/:id", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const project = await repo.update(req.params.id, req.body);
  res.json(project);
}));

// DELETE /api/projects/:id - Supprimer un projet (ADMIN ONLY)
router.delete("/:id", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  await repo.delete(req.params.id);
  res.status(204).send();
}));

export default router;
