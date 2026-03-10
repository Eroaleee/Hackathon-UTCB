"""
ArcGIS proxy routes — backend adds the API token so it's never exposed in frontend.
Frontend calls /arcgis/lanes, /arcgis/route etc. instead of ArcGIS directly.
"""
from fastapi import APIRouter, Query
import httpx
from app.config import ARCGIS_API_KEY, ARCGIS_FEATURE_SERVICE_URL, ARCGIS_LANES_LAYER

router = APIRouter(prefix="/arcgis", tags=["ArcGIS Proxy"])

@router.get("/lanes")
async def get_lanes(where: str = "1=1"):
    """Proxy: fetch bike lanes from ArcGIS Feature Layer as GeoJSON."""
    url = f"{ARCGIS_FEATURE_SERVICE_URL}/{ARCGIS_LANES_LAYER}/query"
    params = {
        "where": where,
        "f": "geojson",
        "outFields": "*",
        "token": ARCGIS_API_KEY
    }
    async with httpx.AsyncClient() as client:
        r = await client.get(url, params=params, timeout=15)
    return r.json()

@router.get("/route")
async def get_bike_route(
    start_lng: float = Query(...),
    start_lat: float = Query(...),
    end_lng: float = Query(...),
    end_lat: float = Query(...)
):
    """Proxy: get bike route between two points using ArcGIS Route Service."""
    url = "https://route-api.arcgis.com/arcgis/rest/services/World/Route/NAServer/Route_World/solve"
    stops = f"{start_lng},{start_lat};{end_lng},{end_lat}"
    params = {
        "stops": stops,
        "f": "json",
        "travelMode": '{"type":"WALK"}',
        "returnRoutes": "true",
        "returnDirections": "true",
        "token": ARCGIS_API_KEY
    }
    async with httpx.AsyncClient() as client:
        r = await client.get(url, params=params, timeout=20)
    return r.json()

@router.get("/danger-heatmap")
async def get_danger_heatmap():
    """
    Aggregate citizen issues into a danger heatmap by grid cell.
    Used by both apps to show danger zones.
    """
    url = f"{ARCGIS_FEATURE_SERVICE_URL}/0/query"
    params = {
        "where": "status='open'",
        "f": "geojson",
        "outFields": "severity,category",
        "token": ARCGIS_API_KEY
    }
    async with httpx.AsyncClient() as client:
        r = await client.get(url, params=params, timeout=15)
    return r.json()
