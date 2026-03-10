from sqlalchemy import Column, Integer, String, Float, DateTime, Text
from datetime import datetime
from app.database import Base

class CitizenIssue(Base):
    """
    Citizen-reported issues stored locally AND synced to ArcGIS Issues layer.
    Local copy kept for offline resilience and AI training data.
    """
    __tablename__ = "citizen_issues"
    id = Column(Integer, primary_key=True, index=True)
    category = Column(String)   # blocked_lane | pothole | missing_sign | danger | car_occupation
    description = Column(Text)
    severity = Column(Integer)  # 1 (minor) to 5 (critical)
    status = Column(String, default="open")  # open | acknowledged | resolved
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    arcgis_oid = Column(Integer, nullable=True)  # ObjectID from ArcGIS after sync
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
