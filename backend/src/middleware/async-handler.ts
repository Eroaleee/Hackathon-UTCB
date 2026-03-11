import { Request, Response, NextFunction } from "express";

/**
 * Wraps an async route handler so that thrown errors are caught
 * and forwarded as a 500 JSON response instead of crashing the process.
 */
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch((err: any) => {
      console.error(`[ERROR] ${req.method} ${req.originalUrl}:`, err?.message || err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Eroare internă a serverului." });
      }
    });
  };
}
