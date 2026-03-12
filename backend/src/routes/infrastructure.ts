import { Router, Request, Response } from "express";
import { asyncHandler } from "../middleware/async-handler";
import prisma from "../prisma";
import { requireAdmin } from "../middleware/auth";

const router = Router();

/** GET /api/infrastructure/layers — Public: list all map layers with element counts */
router.get("/layers", async (req: Request, res: Response) => {
  const layers = await prisma.infrastructureLayer.findMany({
    orderBy: { type: "asc" },
    include: { _count: { select: { elements: true } } },
  });

  const result = layers.map((l) => ({
    id: l.id,
    type: l.type,
    label: l.label,
    color: l.color,
    icon: l.icon,
    isDefaultVisible: l.isDefaultVisible,
    count: l._count.elements,
  }));

  res.json(result);
});

/** GET /api/infrastructure/road-nodes — Public: list all road nodes (for snapping) */
router.get("/road-nodes", async (_req: Request, res: Response) => {
  const nodes = await prisma.roadNode.findMany({
    select: { id: true, latitude: true, longitude: true, name: true },
  });
  res.json(nodes);
});

/** GET /api/infrastructure — Public: list all infrastructure elements */
router.get("/", async (req: Request, res: Response) => {
  const { type, projectId } = req.query;

  const where: any = {};
  if (type) where.type = type;
  if (projectId) where.projectId = projectId;

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

/** POST /api/infrastructure — Admin: create an infrastructure element */
router.post("/", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { layerId, type, typeLabel, name, geometry, properties, projectId } = req.body;

  if (!layerId || !type || !name || !geometry) {
    res.status(400).json({ error: "Câmpuri obligatorii lipsă (layerId, type, name, geometry)." });
    return;
  }

  const element = await prisma.infrastructureElement.create({
    data: {
      layerId,
      type,
      typeLabel: typeLabel || type,
      name,
      geometry,
      properties: properties || {},
      projectId: projectId || null,
    },
    include: {
      layer: { select: { id: true, type: true, label: true, color: true, icon: true } },
    },
  });

  res.status(201).json(element);
}));

/** PATCH /api/infrastructure/:id — Admin: update an infrastructure element */
router.patch("/:id", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { name, geometry, properties, type, typeLabel, layerId } = req.body;

  const data: any = {};
  if (name !== undefined) data.name = name;
  if (geometry !== undefined) data.geometry = geometry;
  if (properties !== undefined) data.properties = properties;
  if (type !== undefined) data.type = type;
  if (typeLabel !== undefined) data.typeLabel = typeLabel;
  if (layerId !== undefined) data.layerId = layerId;

  const element = await prisma.infrastructureElement.update({
    where: { id },
    data,
    include: {
      layer: { select: { id: true, type: true, label: true, color: true, icon: true } },
    },
  });

  res.json(element);
}));

/** DELETE /api/infrastructure/:id — Admin: delete an infrastructure element */
router.delete("/:id", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  await prisma.infrastructureElement.delete({ where: { id } });
  res.json({ deleted: true });
}));

export default router;