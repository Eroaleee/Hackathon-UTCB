import { Router, Request, Response } from "express";
import prisma from "../prisma";

const router = Router();

/** GET /api/transit/stops — Public: list transit stops, optionally filtered by bounds */
router.get("/stops", async (req: Request, res: Response) => {
  try {
    const { minLat, maxLat, minLng, maxLng, type } = req.query;
    const where: any = {};

    if (minLat && maxLat && minLng && maxLng) {
      where.latitude = { gte: parseFloat(minLat as string), lte: parseFloat(maxLat as string) };
      where.longitude = { gte: parseFloat(minLng as string), lte: parseFloat(maxLng as string) };
    }
    if (type !== undefined) where.type = parseInt(type as string);

    const stops = await prisma.transitStop.findMany({ where, take: 2000 });
    res.json(stops);
  } catch (e: any) {
    res.status(500).json({ error: "Eroare.", details: e.message });
  }
});

/** GET /api/transit/routes — Public: list transit routes */
router.get("/routes", async (req: Request, res: Response) => {
  try {
    const { type } = req.query;
    const where: any = {};
    if (type !== undefined) where.type = parseInt(type as string);

    const routes = await prisma.transitRoute.findMany({
      where,
      include: { _count: { select: { shapes: true } } },
    });
    res.json(routes);
  } catch (e: any) {
    res.status(500).json({ error: "Eroare.", details: e.message });
  }
});

/** GET /api/transit/shapes — Public: get route shapes as GeoJSON FeatureCollection */
router.get("/shapes", async (req: Request, res: Response) => {
  try {
    const { routeId } = req.query;
    const where: any = {};
    if (routeId) where.routeId = routeId;

    const shapes = await prisma.transitShape.findMany({
      where,
      include: { route: { select: { shortName: true, type: true, color: true } } },
      take: 500,
    });

    const features = shapes.map((s) => ({
      type: "Feature" as const,
      geometry: s.geometry,
      properties: {
        shapeId: s.shapeId,
        routeId: s.routeId,
        routeName: s.route?.shortName || "",
        routeType: s.route?.type ?? 3,
        routeColor: s.route?.color || "#888888",
      },
    }));

    res.json({ type: "FeatureCollection", features });
  } catch (e: any) {
    res.status(500).json({ error: "Eroare.", details: e.message });
  }
});

export default router;
