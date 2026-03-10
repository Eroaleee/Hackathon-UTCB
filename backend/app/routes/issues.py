from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional, List
from app.database import get_db
from app.models.issue import CitizenIssue
from app.services import arcgis_sync

router = APIRouter(prefix="/issues", tags=["Citizen Issues"])

class IssueCreate(BaseModel):
    category: str = Field(..., description="blocked_lane | pothole | missing_sign | danger | car_occupation")
    description: str
    severity: int = Field(..., ge=1, le=5)
    lat: float
    lng: float

class IssueResponse(BaseModel):
    id: int
    category: str
    description: str
    severity: int
    status: str
    lat: float
    lng: float
    created_at: str

    class Config:
        from_attributes = True

@router.post("/", response_model=dict)
async def create_issue(issue: IssueCreate, db: Session = Depends(get_db)):
    """Submit a citizen issue report. Saves locally + syncs to ArcGIS."""
    db_issue = CitizenIssue(**issue.model_dump())
    db.add(db_issue)
    db.commit()
    db.refresh(db_issue)

    # Async sync to ArcGIS (non-blocking — don't fail if ArcGIS is down)
    try:
        oid = await arcgis_sync.push_issue(db_issue)
        db_issue.arcgis_oid = oid
        db.commit()
    except Exception as e:
        print(f"⚠️ ArcGIS sync failed (non-critical): {e}")

    return {"id": db_issue.id, "status": "created", "message": "Issue reported successfully"}

@router.get("/", response_model=List[dict])
def list_issues(status: Optional[str] = "open", db: Session = Depends(get_db)):
    """List all issues, optionally filtered by status."""
    query = db.query(CitizenIssue)
    if status:
        query = query.filter(CitizenIssue.status == status)
    issues = query.order_by(CitizenIssue.created_at.desc()).all()
    return [
        {
            "id": i.id,
            "category": i.category,
            "description": i.description,
            "severity": i.severity,
            "status": i.status,
            "lat": i.lat,
            "lng": i.lng,
            "created_at": str(i.created_at)
        }
        for i in issues
    ]

@router.get("/geojson")
def issues_geojson(db: Session = Depends(get_db)):
    """Return all open issues as GeoJSON FeatureCollection."""
    issues = db.query(CitizenIssue).filter(CitizenIssue.status == "open").all()
    features = [
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [i.lng, i.lat]},
            "properties": {
                "id": i.id, "category": i.category,
                "severity": i.severity, "description": i.description,
                "created_at": str(i.created_at)
            }
        }
        for i in issues
    ]
    return {"type": "FeatureCollection", "features": features}

@router.patch("/{issue_id}/status")
def update_issue_status(issue_id: int, status: str, db: Session = Depends(get_db)):
    """Admin: update issue status."""
    issue = db.query(CitizenIssue).filter(CitizenIssue.id == issue_id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    issue.status = status
    db.commit()
    return {"id": issue_id, "status": status}
