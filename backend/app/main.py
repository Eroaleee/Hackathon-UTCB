from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import issues, parking, arcgis, simulation

app = FastAPI(title="Masterplan Velo API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Hackathon: allow all origins
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(issues.router)
app.include_router(parking.router)
app.include_router(arcgis.router)
app.include_router(simulation.router)

@app.get("/health")
def health():
    return {"status": "ok", "project": "Masterplan Velo Bucharest"}
