from sqlalchemy import Column, Integer, String, Float, DateTime
from datetime import datetime
from app.database import Base

class BikeParking(Base):
    """
    Bike parking spots placed by admins.
    Synced to ArcGIS Parking layer.
    """
    __tablename__ = "bike_parking"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    capacity = Column(Integer, default=10)
    parking_type = Column(String, default="rack")  # rack | locker | station
    status = Column(String, default="proposed")    # proposed | approved | installed
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    arcgis_oid = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
