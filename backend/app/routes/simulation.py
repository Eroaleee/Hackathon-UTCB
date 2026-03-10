from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import httpx
from app.config import AI_ENGINE_URL

router = APIRouter(prefix="/simulation", tags=["AI Simulation"])

class SimulationRequest(BaseModel):
    n_cyclists: int = 200
    steps: int = 100
    scenario_geojson: Optional[dict] = None

@router.post("/run")
async def run_simulation(req: SimulationRequest):
    """Trigger AI simulation engine and return heatmap GeoJSON."""
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            r = await client.post(f"{AI_ENGINE_URL}/simulate", json=req.model_dump())
        return r.json()
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"AI engine unavailable: {str(e)}")

@router.get("/status")
async def simulation_status():
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(f"{AI_ENGINE_URL}/health")
        return r.json()
    except Exception:
        return {"status": "offline"}
