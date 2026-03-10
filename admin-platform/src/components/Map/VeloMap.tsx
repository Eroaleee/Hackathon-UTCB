import { useEffect, useRef } from "react";
import Map from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import { FEATURE_SERVICE_URL, ISSUES_LAYER_URL } from "../../config/arcgis";

interface VeloMapProps {
  onMapReady?: (view: MapView) => void;
  showIssues?: boolean;
  showSimulation?: boolean;
  simulationGeoJSON?: any;
}

export default function VeloMap({ onMapReady, showIssues }: VeloMapProps) {
  const mapDiv = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mapDiv.current) return;

    const map = new Map({ basemap: "streets-navigation-vector" });

    // MasterPlan Velo lanes from ArcGIS Feature Layer
    const lanesLayer = new FeatureLayer({
      url: `${FEATURE_SERVICE_URL}/0`,
      title: "Masterplan Velo — Bike Lanes",
      renderer: {
        type: "unique-value",
        field: "status",
        uniqueValueInfos: [
          { value: "active", symbol: { type: "simple-line", color: [34, 197, 94], width: 3 } },
          { value: "planned", symbol: { type: "simple-line", color: [59, 130, 246], width: 2, style: "dash" } },
          { value: "under_construction", symbol: { type: "simple-line", color: [251, 191, 36], width: 2 } },
        ]
      } as any
    });
    map.add(lanesLayer);

    // Citizen Issues from ArcGIS Issues Layer
    if (showIssues) {
      const issuesLayer = new FeatureLayer({
        url: ISSUES_LAYER_URL,
        title: "Citizen Reports",
        renderer: {
          type: "simple",
          symbol: { type: "simple-marker", color: [239, 68, 68], size: 8, outline: { color: "white", width: 1 } }
        } as any
      });
      map.add(issuesLayer);
    }

    const view = new MapView({
      container: mapDiv.current,
      map,
      center: [26.1025, 44.4268], // Bucharest
      zoom: 12
    });

    view.when(() => onMapReady?.(view));

    return () => { view.destroy(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={mapDiv} style={{ width: "100%", height: "100%" }} />;
}
