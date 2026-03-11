import { Router, Request, Response } from "express";
import prisma from "../prisma";

const router = Router();

/** GET /api/simulations/baseline — Public: current infrastructure baseline metrics */
router.get("/baseline", async (_req: Request, res: Response) => {
  // Count infrastructure elements by type
  const [totalBikeLanes, totalBikeParking, totalTrafficLights, totalZone30, totalPedestrianZones, totalReports, resolvedReports, conflictReports] =
    await Promise.all([
      prisma.infrastructureElement.count({ where: { type: "pista_biciclete" } }),
      prisma.infrastructureElement.count({ where: { type: "parcare_biciclete" } }),
      prisma.infrastructureElement.count({ where: { type: "semafor" } }),
      prisma.infrastructureElement.count({ where: { type: "zona_30" } }),
      prisma.infrastructureElement.count({ where: { type: "zona_pietonala" } }),
      prisma.report.count(),
      prisma.report.count({ where: { status: "rezolvat" } }),
      prisma.report.count({
        where: { status: { in: ["trimis", "in_analiza"] }, severity: { in: ["ridicat", "critic"] } },
      }),
    ]);

  const totalInfra = totalBikeLanes + totalBikeParking + totalTrafficLights + totalZone30 + totalPedestrianZones;

  // Safety: based on resolved rate and infrastructure density
  const resolvedRate = totalReports > 0 ? resolvedReports / totalReports : 0;
  const safetyScore = Math.round(Math.min(resolvedRate * 60 + Math.min(totalInfra, 50), 100));

  // Coverage: bike lane elements as percentage of total infra target (100 considered full coverage)
  const coveragePercent = Math.round(Math.min((totalBikeLanes / 100) * 100, 100));

  // Conflict zones: high/critical unresolved reports
  const conflictZones = conflictReports;

  // Accessibility: based on pedestrian zones, bike parking, zone 30
  const accessibilityScore = Math.round(
    Math.min((totalPedestrianZones * 5 + totalBikeParking * 1.5 + totalZone30 * 3), 100)
  );

  res.json({ safetyScore, coveragePercent, conflictZones, accessibilityScore });
});

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
