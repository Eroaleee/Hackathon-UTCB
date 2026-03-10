import { useEffect } from "react";
import { initArcGIS, DASHBOARD_URL } from "../config/arcgis";
import VeloMap from "../components/Map/VeloMap";

export default function AdminApp() {
  useEffect(() => { initArcGIS(); }, []);

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "sans-serif" }}>
      {/* Sidebar */}
      <div style={{ width: 320, background: "#1a1a2e", color: "white", padding: 20, overflowY: "auto" }}>
        <h2>🚲 Masterplan Velo</h2>
        <h3>Admin Platform</h3>
        <hr />
        <nav>
          <p>📊 <a href={DASHBOARD_URL} target="_blank" rel="noreferrer" style={{ color: "#60a5fa" }}>
            Open ArcGIS Dashboard
          </a></p>
          <p>🗺️ Digital Twin Map</p>
          <p>⚠️ Citizen Issues</p>
          <p>🅿️ Parking Planner</p>
          <p>🤖 AI Simulation</p>
        </nav>
      </div>
      {/* Map */}
      <div style={{ flex: 1 }}>
        <VeloMap showIssues={true} />
      </div>
    </div>
  );
}
