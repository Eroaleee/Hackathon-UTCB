import { Router, Request, Response } from "express";
import prisma from "../prisma";

const router = Router();

/**
 * POST /api/auth/register — Quick registration with just a nickname.
 * Returns sessionToken that the frontend stores in localStorage.
 */
router.post("/register", async (req: Request, res: Response) => {
  const { nickname, email, neighborhood } = req.body;

  if (!nickname || typeof nickname !== "string" || nickname.trim().length < 2) {
    res.status(400).json({ error: "Nickname-ul trebuie să aibă minimum 2 caractere." });
    return;
  }

  const user = await prisma.user.create({
    data: {
      nickname: nickname.trim(),
      email: email || null,
      neighborhood: neighborhood || null,
    },
    select: {
      id: true,
      nickname: true,
      email: true,
      role: true,
      sessionToken: true,
      xp: true,
      level: true,
      levelName: true,
      neighborhood: true,
      createdAt: true,
    },
  });

  res.status(201).json(user);
});

/**
 * GET /api/auth/me — Get current user info from session token.
 */
router.get("/me", async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) {
    res.status(401).json({ error: "Nu ești autentificat." });
    return;
  }

  const full = await prisma.user.findUnique({
    where: { id: user.id },
    include: {
      badges: { include: { badge: true } },
    },
  });

  res.json(full);
});

export default router;
