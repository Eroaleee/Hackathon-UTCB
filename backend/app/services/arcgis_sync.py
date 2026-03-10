"""
Syncs local SQLite records to ArcGIS Feature Layers.
Non-blocking — failures are logged but don't crash the API.
"""
import httpx
from app.config import ARCGIS_API_KEY, ARCGIS_ISSUES_LAYER_URL

async def push_issue(issue) -> int | None:
    """Push a citizen issue to ArcGIS Issues Feature Layer. Returns ArcGIS ObjectID."""
    url = f"{ARCGIS_ISSUES_LAYER_URL}/addFeatures"
    feature = {
        "geometry": {
            "x": issue.lng,
            "y": issue.lat,
            "spatialReference": {"wkid": 4326}
        },
        "attributes": {
            "category": issue.category,
            "description": issue.description,
            "severity": issue.severity,
            "status": issue.status,
            "local_id": issue.id
        }
    }
    import json
    params = {
        "features": json.dumps([feature]),
        "f": "json",
        "token": ARCGIS_API_KEY
    }
    async with httpx.AsyncClient() as client:
        r = await client.post(url, data=params, timeout=10)
    result = r.json()
    if result.get("addResults") and result["addResults"][0].get("success"):
        return result["addResults"][0]["objectId"]
    return None
