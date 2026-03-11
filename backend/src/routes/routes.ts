import { Router, Request, Response } from "express";
import { planRoute } from "../services/routing";

const router = Router();

/**
 * POST /api/routes/plan
 * Body: { startLat, startLng, endLat, endLng }
 * Returns the best cycling route with safe-spot suggestions.
 */
router.post("/plan", async (req: Request, res: Response) => {
  try {
    const { startLat, startLng, endLat, endLng } = req.body;

    if (
      typeof startLat !== "number" || typeof startLng !== "number" ||
      typeof endLat !== "number" || typeof endLng !== "number"
    ) {
      res.status(400).json({ error: "Coordonate lipsă sau invalide. Trimite: startLat, startLng, endLat, endLng." });
      return;
    }

    const result = await planRoute({ startLat, startLng, endLat, endLng });
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: "Eroare la calculul rutei.", details: e.message });
  }
});

export default router;
