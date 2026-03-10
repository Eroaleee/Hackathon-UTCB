import { Request, Response, NextFunction } from "express";
import prisma from "../prisma";

/**
 * Lightweight auth middleware.
 * Reads `x-session-token` header. If valid, attaches `req.user`.
 * Does NOT block the request — downstream handlers decide whether to require auth.
 */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = req.headers["x-session-token"] as string | undefined;
  if (token) {
    const user = await prisma.user.findUnique({ where: { sessionToken: token } });
    if (user) {
      (req as any).user = user;
    }
  }
  next();
}

/**
 * Middleware that requires a valid session.
 * Use for endpoints that need an authenticated citizen (comments, votes, likes).
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!(req as any).user) {
    res.status(401).json({ error: "Autentificare necesară. Creează un cont rapid cu un nickname." });
    return;
  }
  next();
}
