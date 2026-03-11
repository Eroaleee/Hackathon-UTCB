import { Router, Request, Response } from "express";
import prisma from "../prisma";
import { processUserAction, notifyUser } from "../services/gamification";
import { asyncHandler } from "../middleware/async-handler";

const router = Router();

/** GET /api/reports — Public: list all reports with optional filters */
router.get("/", asyncHandler(async (req: Request, res: Response) => {
  const { status, category, severity } = req.query;

  const where: any = {};
  if (status) where.status = status;
  if (category) where.category = category;
  if (severity) where.severity = severity;

  const reports = await prisma.report.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { id: true, nickname: true, avatar: true } },
      photos: { select: { id: true, url: true } },
    },
  });

  res.json(reports);
}));

/** GET /api/reports/:id — Public: single report */
router.get("/:id", asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const report = await prisma.report.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, nickname: true, avatar: true } },
      photos: { select: { id: true, url: true } },
    },
  });

  if (!report) {
    res.status(404).json({ error: "Raportul nu a fost găsit." });
    return;
  }

  // Increment seen count
  await prisma.report.update({
    where: { id },
    data: { seenCount: { increment: 1 } },
  });

  res.json(report);
}));

/** POST /api/reports — Public: anyone can submit a report (anonymous or authenticated) */
router.post("/", asyncHandler(async (req: Request, res: Response) => {
  const { category, categoryLabel, severity, title, description, latitude, longitude, address, photos } = req.body;

  if (!category || !title || !description || latitude == null || longitude == null || !address) {
    res.status(400).json({ error: "Câmpuri obligatorii lipsă: category, title, description, latitude, longitude, address." });
    return;
  }

  const user = (req as any).user;

  const report = await prisma.report.create({
    data: {
      userId: user?.id || null,
      category,
      categoryLabel: categoryLabel || category,
      severity: severity || "mediu",
      title,
      description,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      address,
      photos: photos?.length
        ? { create: photos.map((url: string) => ({ url })) }
        : undefined,
    },
    include: { photos: { select: { id: true, url: true } } },
  });

  // Gamification: award XP, check badges, log activity
  if (user?.id) {
    try {
      await processUserAction(user.id, "report", `A raportat: ${title}`, `/cetatean/harta`);
    } catch { /* non-blocking */ }
  }

  res.status(201).json(report);
}));

/** PATCH /api/reports/:id/status — Admin: update report status */
router.patch("/:id/status", asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { status } = req.body;

  const report = await prisma.report.update({
    where: { id },
    data: { status },
  });

  // Notify the reporter about status change
  if (report.userId) {
    try {
      const statusLabels: Record<string, string> = {
        in_analiza: "în analiză",
        in_lucru: "în lucru",
        rezolvat: "rezolvat",
        respins: "respins",
      };
      await notifyUser(
        report.userId,
        "report_update",
        "Raportul tău a fost actualizat",
        `Raportul "${report.title}" este acum ${statusLabels[status] || status}.`,
        `/cetatean/harta`
      );
    } catch { /* non-blocking */ }
  }

  res.json(report);
}));

export default router;
