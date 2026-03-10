import { Router, Request, Response } from "express";
import prisma from "../prisma";

const router = Router();

/** GET /api/simulations — Public: list all simulation scenarios */
router.get("/", async (_req: Request, res: Response) => {
  const scenarios = await prisma.simulationScenario.findMany({
    orderBy: { createdAt: "desc" },
  });

  // Map to match frontend SimulationScenario type (nested metrics)
  const result = scenarios.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    metrics: {
      safetyScore: s.safetyScore,
      coveragePercent: s.coveragePercent,
      conflictZones: s.conflictZones,
      accessibilityScore: s.accessibilityScore,
    },
  }));

  res.json(result);
});

export default router;
