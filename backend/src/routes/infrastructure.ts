import { Router, Request, Response } from "express";
import prisma from "../prisma";

const router = Router();

/** GET /api/infrastructure/layers — Public: list all map layers */
router.get("/layers", async (req: Request, res: Response) => {
  const layers = await prisma.infrastructureLayer.findMany({
    orderBy: { type: "asc" },
  });
  res.json(layers);
});

/** GET /api/infrastructure — Public: list all infrastructure elements */
router.get("/", async (req: Request, res: Response) => {
  const { type } = req.query;

  const where: any = {};
  if (type) where.type = type;

  const elements = await prisma.infrastructureElement.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      layer: { select: { id: true, type: true, label: true, color: true, icon: true } },
    },
  });

  res.json(elements);
});

/** GET /api/infrastructure/:id */
router.get("/:id", async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const element = await prisma.infrastructureElement.findUnique({
    where: { id },
    include: {
      layer: { select: { id: true, type: true, label: true, color: true, icon: true } },
    },
  });

  if (!element) {
    res.status(404).json({ error: "Elementul nu a fost găsit." });
    return;
  }

  res.json(element);
});

export default router;
