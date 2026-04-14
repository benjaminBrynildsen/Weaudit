/**
 * Auth middleware. Reject unauthenticated requests with 401 so the
 * client can redirect to the login page.
 */

import type { Request, Response, NextFunction } from "express";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({ error: "unauthenticated" });
}
