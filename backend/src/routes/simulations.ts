import { Router, Request, Response } from "express";
import prisma from "../prisma";
import { requireAdmin } from "../middleware/auth";
import { runSimulation } from "../services/simulation";

const router = Router();

/** GET /api/simulations/baseline — Public: current infrastructure baseline via simulation engine */
router.get("/baseline", async (_req: Request, res: Response) => {
  try {
    const result = await runSimulation(null);
    res.json({
      safetyScore: result.safetyScore,
      coveragePercent: result.coveragePercent,
      conflictZones: result.conflictZones,
      accessibilityScore: result.accessibilityScore,
      details: result.details,
    });
  } catch (e: any) {
    res.status(500).json({ error: "Eroare la calculul baseline.", details: e.message });
  }
});

/** GET /api/simulations — Public: list all simulation scenarios */
router.get("/", async (_req: Request, res: Response) => {
  try {
    const scenarios = await prisma.simulationScenario.findMany({
      orderBy: { createdAt: "desc" },
    });

    const result = scenarios.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      changes: s.changes,
      projectId: s.projectId,
      metrics: {
        safetyScore: s.safetyScore,
        coveragePercent: s.coveragePercent,
        conflictZones: s.conflictZones,
        accessibilityScore: s.accessibilityScore,
      },
    }));

    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: "Eroare la încărcarea scenariilor.", details: e.message });
  }
});

/** GET /api/simulations/:id — Public: single scenario with details */
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const scenario = await prisma.simulationScenario.findUnique({ where: { id } });
    if (!scenario) { res.status(404).json({ error: "Scenariul nu a fost găsit." }); return; }

    res.json({
      id: scenario.id,
      name: scenario.name,
      description: scenario.description,
      changes: scenario.changes,
      metrics: {
        safetyScore: scenario.safetyScore,
        coveragePercent: scenario.coveragePercent,
        conflictZones: scenario.conflictZones,
        accessibilityScore: scenario.accessibilityScore,
      },
    });
  } catch (e: any) {
    res.status(500).json({ error: "Eroare.", details: e.message });
  }
});

/** POST /api/simulations — Admin: create a new scenario */
router.post("/", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name, description, changes, projectId } = req.body;
    if (!name) {
      res.status(400).json({ error: "Câmpuri obligatorii: name." });
      return;
    }

    // If projectId provided, use project geometry as changes
    let simChanges = changes || null;
    if (projectId && !simChanges) {
      const project = await prisma.project.findUnique({ where: { id: projectId } });
      if (project?.geometry) simChanges = project.geometry;
    }

    // Run simulation with proposed changes
    const result = await runSimulation(simChanges);

    const scenario = await prisma.simulationScenario.create({
      data: {
        name,
        description: description || `Simulare pentru ${name}`,
        changes: simChanges,
        projectId: projectId || null,
        safetyScore: result.safetyScore,
        coveragePercent: result.coveragePercent,
        conflictZones: result.conflictZones,
        accessibilityScore: result.accessibilityScore,
      },
    });

    res.status(201).json({
      id: scenario.id,
      name: scenario.name,
      description: scenario.description,
      changes: scenario.changes,
      projectId: scenario.projectId,
      metrics: {
        safetyScore: scenario.safetyScore,
        coveragePercent: scenario.coveragePercent,
        conflictZones: scenario.conflictZones,
        accessibilityScore: scenario.accessibilityScore,
      },
      details: result.details,
    });
  } catch (e: any) {
    res.status(500).json({ error: "Eroare la crearea scenariului.", details: e.message });
  }
});

/** PUT /api/simulations/:id — Admin: update a scenario and re-run simulation */
router.put("/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { name, description, changes } = req.body;

    const result = await runSimulation(changes || null);

    const scenario = await prisma.simulationScenario.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        changes: changes || null,
        safetyScore: result.safetyScore,
        coveragePercent: result.coveragePercent,
        conflictZones: result.conflictZones,
        accessibilityScore: result.accessibilityScore,
      },
    });

    res.json({
      id: scenario.id,
      name: scenario.name,
      description: scenario.description,
      changes: scenario.changes,
      metrics: {
        safetyScore: scenario.safetyScore,
        coveragePercent: scenario.coveragePercent,
        conflictZones: scenario.conflictZones,
        accessibilityScore: scenario.accessibilityScore,
      },
      details: result.details,
    });
  } catch (e: any) {
    res.status(500).json({ error: "Eroare la actualizarea scenariului.", details: e.message });
  }
});

/** POST /api/simulations/:id/run — Admin: re-run simulation for existing scenario */
router.post("/:id/run", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const scenario = await prisma.simulationScenario.findUnique({ where: { id } });
    if (!scenario) { res.status(404).json({ error: "Scenariul nu a fost găsit." }); return; }

    const result = await runSimulation(scenario.changes as any);

    await prisma.simulationScenario.update({
      where: { id },
      data: {
        safetyScore: result.safetyScore,
        coveragePercent: result.coveragePercent,
        conflictZones: result.conflictZones,
        accessibilityScore: result.accessibilityScore,
      },
    });

    res.json({
      id: scenario.id,
      name: scenario.name,
      metrics: {
        safetyScore: result.safetyScore,
        coveragePercent: result.coveragePercent,
        conflictZones: result.conflictZones,
        accessibilityScore: result.accessibilityScore,
      },
      details: result.details,
    });
  } catch (e: any) {
    res.status(500).json({ error: "Eroare la rularea simulării.", details: e.message });
  }
});

/** POST /api/simulations/preview — Admin: run simulation without saving */
router.post("/preview", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { changes } = req.body;
    const result = await runSimulation(changes || null);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: "Eroare la simulare.", details: e.message });
  }
});

/** DELETE /api/simulations/:id — Admin: delete a scenario */
router.delete("/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    await prisma.simulationScenario.delete({ where: { id } });
    res.json({ deleted: true });
  } catch (e: any) {
    res.status(500).json({ error: "Eroare la ștergerea scenariului.", details: e.message });
  }
});

/** GET /api/simulations/network/roads — Public: get road network for map display */
router.get("/network/roads", async (_req: Request, res: Response) => {
  try {
    const segments = await prisma.roadSegment.findMany();
    const features = segments.map((s) => ({
      type: "Feature" as const,
      geometry: s.geometry,
      properties: {
        id: s.id,
        name: s.name,
        roadType: s.roadType,
        length: s.length,
        safetyScore: s.safetyScore,
        trafficLoad: s.trafficLoad,
        speedLimit: s.speedLimit,
      },
    }));
    res.json({ type: "FeatureCollection", features });
  } catch (e: any) {
    res.status(500).json({ error: "Eroare.", details: e.message });
  }
});

export default router;
