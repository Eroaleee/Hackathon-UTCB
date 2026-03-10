import { Router, Request, Response } from "express";
import prisma from "../prisma";
import { requireAuth } from "../middleware/auth";

const router = Router();

/** GET /api/notifications — Auth required: user's notifications */
router.get("/", requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user;

  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  res.json(notifications);
});

/** PATCH /api/notifications/:id/read — Auth required: mark as read */
router.patch("/:id/read", requireAuth, async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const user = (req as any).user;

  const notification = await prisma.notification.updateMany({
    where: { id, userId: user.id },
    data: { read: true },
  });

  res.json({ success: notification.count > 0 });
});

/** PATCH /api/notifications/read-all — Auth required: mark all as read */
router.patch("/read-all", requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user;

  await prisma.notification.updateMany({
    where: { userId: user.id, read: false },
    data: { read: true },
  });

  res.json({ success: true });
});

export default router;
