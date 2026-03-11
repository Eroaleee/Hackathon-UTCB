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

/** POST /api/notifications/broadcast — Admin only: send notification to all users */
router.post("/broadcast", requireAuth, async (req: Request, res: Response) => {
  const sender = (req as any).user;
  if (sender.role !== "admin") {
    res.status(403).json({ error: "Acces interzis" });
    return;
  }

  const { type, title, message, link } = req.body;
  if (!type || !title || !message) {
    res.status(400).json({ error: "type, title, and message are required" });
    return;
  }

  const users = await prisma.user.findMany({ select: { id: true } });

  await prisma.notification.createMany({
    data: users.map((u) => ({
      userId: u.id,
      type,
      title,
      message,
      link: link || null,
      read: false,
    })),
  });

  res.json({ success: true, count: users.length });
});

export default router;
