"use client";

import { MapContainer, TileLayer, Polyline, CircleMarker, GeoJSON, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useInfrastructureElements } from "@/lib/api";
import { useMemo } from "react";

interface SimMapProps {
  variant: "current" | "future";
  scenarioChanges?: any;
  projectGeometry?: any;
}

const infraColors: Record<string, string> = {
  pista_biciclete: "#a3e635",
  parcare_biciclete: "#22d3ee",
  semafor: "#f59e0b",
  zona_30: "#818cf8",
  zona_pietonala: "#34d399",
};

export default function SimMap({ variant, scenarioChanges, projectGeometry }: SimMapProps) {
  const { data: infraElements } = useInfrastructureElements();

  const infraPolylines = useMemo(() => {
    return (infraElements ?? []).filter((e: any) => e.geometry?.type === "LineString");
  }, [infraElements]);

  const infraPoints = useMemo(() => {
    return (infraElements ?? []).filter((e: any) => e.geometry?.type === "Point");
  }, [infraElements]);

  const projGeoKey = useMemo(() => JSON.stringify(projectGeometry), [projectGeometry]);
  const scenarioKey = useMemo(() => JSON.stringify(scenarioChanges), [scenarioChanges]);

  return (
    <MapContainer center={[44.4505, 26.12]} zoom={14} className="h-full w-full" zoomControl={false}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Infrastructure polylines (bike lanes) — same as harta map */}
      {infraPolylines.map((el: any) => {
        const coords: [number, number][] = el.geometry.coordinates.map(
          ([lng, lat]: [number, number]) => [lat, lng] as [number, number]
        );
        return (
          <Polyline
            key={`infra-${el.id}`}
            positions={coords}
            pathOptions={{
              color: infraColors[el.type] || "#a3e635",
              weight: 6,
              opacity: variant === "future" ? 0.4 : 0.95,
            }}
          >
            <Tooltip sticky>{el.name || el.type}</Tooltip>
          </Polyline>
        );
      })}

      {/* Infrastructure points (bike parking, signals) */}
      {infraPoints.map((el: any) => {
        const [lng, lat] = el.geometry.coordinates;
        return (
          <CircleMarker
            key={`infra-pt-${el.id}`}
            center={[lat, lng]}
            radius={6}
            pathOptions={{
              fillColor: infraColors[el.type] || "#a3e635",
              color: "#fff",
              weight: 1,
              fillOpacity: 0.8,
            }}
          >
            <Tooltip>{el.name || el.type}</Tooltip>
          </CircleMarker>
        );
      })}

      {/* Scenario changes overlay on future map */}
      {variant === "future" && scenarioChanges && (
        <GeoJSON
          key={`scenario-${scenarioKey}`}
          data={scenarioChanges}
          style={(feature: any) => {
            const featureType = feature?.properties?.type || "";
            return {
              color: infraColors[featureType] || "#a3e635",
              weight: 5,
              opacity: 0.85,
              fillOpacity: 0.2,
            };
          }}
        />
      )}

      {/* Project geometry overlay on future map */}
      {variant === "future" && projectGeometry && (
        <GeoJSON
          key={`proj-${projGeoKey}`}
          data={projectGeometry}
          style={() => ({
            color: "#a855f7",
            weight: 5,
            opacity: 0.7,
            dashArray: "10 5",
            fillOpacity: 0.15,
          })}
        />
      )}
    </MapContainer>
  );
}
