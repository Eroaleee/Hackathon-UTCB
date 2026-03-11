import { Router, Request, Response } from "express";
import { asyncHandler } from "../middleware/async-handler";
import prisma from "../prisma";
import { requireAuth } from "../middleware/auth";

const router = Router();

/** GET /api/activities — Auth required: user's recent activities */
router.get("/", requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;

  const activities = await prisma.activity.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  res.json(activities);
}));

export default router;