import { Request, Response, NextFunction } from "express";

/**
 * Middleware d'authentification Basic Auth
 * 
 * Vérifie les credentials admin hardcodés dans .env
 * Protège les routes sensibles du backoffice
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Basic ")) {
    return res.status(401).json({ 
      error: "Authentication required",
      message: "Please provide admin credentials" 
    });
  }

  // Décoder les credentials Base64
  const base64Credentials = authHeader.split(" ")[1];
  const credentials = Buffer.from(base64Credentials, "base64").toString("utf-8");
  const [username, password] = credentials.split(":");

  // Vérifier contre les credentials hardcodés
  const adminUsername = process.env.ADMIN_USERNAME;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminUsername || !adminPassword) {
    console.error("❌ ADMIN_USERNAME or ADMIN_PASSWORD not set in .env");
    return res.status(500).json({ 
      error: "Server configuration error",
      message: "Admin credentials not configured" 
    });
  }

  if (username === adminUsername && password === adminPassword) {
    // Authentification réussie
    next();
  } else {
    return res.status(403).json({ 
      error: "Forbidden",
      message: "Invalid admin credentials" 
    });
  }
};
