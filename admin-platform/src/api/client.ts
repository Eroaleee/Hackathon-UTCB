import axios from "axios";
import { API_URL } from "../config/arcgis";

const api = axios.create({ baseURL: API_URL });

// Issues
export const getIssues = (status = "open") => api.get(`/issues?status=${status}`);
export const getIssuesGeoJSON = () => api.get("/issues/geojson");
export const updateIssueStatus = (id: number, status: string) =>
  api.patch(`/issues/${id}/status?status=${status}`);

// Parking
export const getParkingGeoJSON = () => api.get("/parking/geojson");
export const createParking = (data: any) => api.post("/parking", data);

// ArcGIS proxy
export const getLanesGeoJSON = (where = "1=1") =>
  api.get(`/arcgis/lanes?where=${encodeURIComponent(where)}`);
export const getBikeRoute = (startLng: number, startLat: number, endLng: number, endLat: number) =>
  api.get(`/arcgis/route?start_lng=${startLng}&start_lat=${startLat}&end_lng=${endLng}&end_lat=${endLat}`);

// Simulation
export const runSimulation = (params: { n_cyclists: number; steps: number; scenario_geojson?: any }) =>
  api.post("/simulation/run", params);
export const getSimulationStatus = () => api.get("/simulation/status");
