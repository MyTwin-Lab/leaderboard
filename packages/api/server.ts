import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import challengesRoutes from "./routes/challenges.routes.js";
import usersRoutes from "./routes/users.routes.js";
import contributionsRoutes from "./routes/contributions.routes.js";
import projectsRoutes from "./routes/projects.routes.js";
import reposRoutes from "./routes/repos.routes.js";
import leaderboardRoutes from "./routes/leaderboard.routes.js";
import { errorHandler } from "./middleware/error.js";

const app = express();
const PORT = process.env.API_PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
}));
app.use(express.json());

// Routes
app.use("/api/challenges", challengesRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/contributions", contributionsRoutes);
app.use("/api/projects", projectsRoutes);
app.use("/api/repos", reposRoutes);
app.use("/api/leaderboard", leaderboardRoutes);

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Error handling
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 API Server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});
