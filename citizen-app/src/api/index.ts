import axios from "axios";
import { API_URL } from "../config";

const api = axios.create({ baseURL: API_URL, timeout: 10000 });

// === Bike Lanes (from ArcGIS via backend proxy) ===
export const getLanes = () => api.get("/arcgis/lanes");
export const getDangerHeatmap = () => api.get("/arcgis/danger-heatmap");

// === Routing (ArcGIS Route Service via backend proxy) ===
export const getRoute = (startLng: number, startLat: number, endLng: number, endLat: number) =>
  api.get(`/arcgis/route?start_lng=${startLng}&start_lat=${startLat}&end_lng=${endLng}&end_lat=${endLat}`);

// === Citizen Issues ===
export const reportIssue = (data: {
  category: string;
  description: string;
  severity: number;
  lat: number;
  lng: number;
}) => api.post("/issues", data);

export const getOpenIssues = () => api.get("/issues/geojson");

// === Parking ===
export const getParkingSpots = () => api.get("/parking/geojson");
