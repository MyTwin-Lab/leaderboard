import { Request, Response, NextFunction, RequestHandler } from "express";

/**
 * Wrapper pour gérer les erreurs async dans les routes Express
 */
export const asyncHandler = (fn: any): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
