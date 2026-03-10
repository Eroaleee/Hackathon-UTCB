import esriConfig from "@arcgis/core/config";

export const ARCGIS_API_KEY = process.env.REACT_APP_ARCGIS_API_KEY!;
export const FEATURE_SERVICE_URL = process.env.REACT_APP_ARCGIS_FEATURE_SERVICE_URL!;
export const ISSUES_LAYER_URL = process.env.REACT_APP_ARCGIS_ISSUES_LAYER_URL!;
export const DASHBOARD_URL = process.env.REACT_APP_ARCGIS_DASHBOARD_URL!;
export const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";

// Initialize ArcGIS with API key — call this once at app startup
export function initArcGIS() {
  esriConfig.apiKey = ARCGIS_API_KEY;
}
