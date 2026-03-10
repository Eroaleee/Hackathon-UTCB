from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), "simulation"))
from run_simulation import run  # noqa: E402

app = FastAPI(title="Velo AI Engine", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


class SimRequest(BaseModel):
    n_cyclists: int = 200
    steps: int = 100
    scenario_geojson: Optional[dict] = None


@app.get("/health")
def health():
    return {"status": "online", "service": "Velo AI Simulation Engine"}


@app.post("/simulate")
def simulate(req: SimRequest):
    """Run agent-based simulation. Returns GeoJSON heatmap of cyclist flow."""
    result = run(
        n_cyclists=req.n_cyclists,
        steps=req.steps,
        scenario_geojson=req.scenario_geojson
    )
    return result
