import { Router, Request, Response } from "express";
import { UserRepository } from "../../database-service/repositories/index.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { requireAdmin } from "../middleware/auth.js";

const router = Router();
const repo = new UserRepository();

// GET /api/users - Liste tous les users
router.get("/", asyncHandler(async (req: Request, res: Response) => {
  const users = await repo.findAll();
  res.json(users);
}));

// GET /api/users/:id - Détails d'un user
router.get("/:id", asyncHandler(async (req: Request, res: Response) => {
  const user = await repo.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  res.json(user);
}));

// GET /api/users/:id/contributions - Contributions d'un user
router.get("/:id/contributions", asyncHandler(async (req: Request, res: Response) => {
  const contributions = await repo.findContributions(req.params.id);
  res.json(contributions);
}));

// GET /api/users/github/:username - User par GitHub username
router.get("/github/:username", asyncHandler(async (req: Request, res: Response) => {
  const user = await repo.findByGithub(req.params.username);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  res.json(user);
}));

// POST /api/users - Créer un user (ADMIN ONLY)
router.post("/", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const user = await repo.create(req.body);
  res.status(201).json(user);
}));

// PUT /api/users/:id - Modifier un user (ADMIN ONLY)
router.put("/:id", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const user = await repo.update(req.params.id, req.body);
  res.json(user);
}));

// DELETE /api/users/:id - Supprimer un user (ADMIN ONLY)
router.delete("/:id", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  await repo.delete(req.params.id);
  res.status(204).send();
}));

export default router;
