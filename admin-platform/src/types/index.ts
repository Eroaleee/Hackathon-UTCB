export interface CitizenIssue {
  id: number;
  category: "blocked_lane" | "pothole" | "missing_sign" | "danger" | "car_occupation";
  description: string;
  severity: 1 | 2 | 3 | 4 | 5;
  status: "open" | "acknowledged" | "resolved";
  lat: number;
  lng: number;
  created_at: string;
}

export interface BikeParking {
  id: number;
  name: string;
  capacity: number;
  parking_type: "rack" | "locker" | "station";
  status: "proposed" | "approved" | "installed";
  lat: number;
  lng: number;
}

export interface SimulationResult {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    geometry: { type: "LineString"; coordinates: number[][] };
    properties: { usage_count: number; intensity: number };
  }>;
}
