from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.database import get_db
from app.models.parking import BikeParking

router = APIRouter(prefix="/parking", tags=["Bike Parking"])

class ParkingCreate(BaseModel):
    name: str
    capacity: int = 10
    parking_type: str = "rack"
    lat: float
    lng: float

@router.post("/")
def create_parking(spot: ParkingCreate, db: Session = Depends(get_db)):
    db_spot = BikeParking(**spot.model_dump())
    db.add(db_spot)
    db.commit()
    db.refresh(db_spot)
    return {"id": db_spot.id, "status": "created"}

@router.get("/geojson")
def parking_geojson(db: Session = Depends(get_db)):
    spots = db.query(BikeParking).all()
    features = [
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [s.lng, s.lat]},
            "properties": {"id": s.id, "name": s.name, "capacity": s.capacity, "type": s.parking_type, "status": s.status}
        }
        for s in spots
    ]
    return {"type": "FeatureCollection", "features": features}
