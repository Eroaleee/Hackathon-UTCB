"use client";

import { MapContainer, TileLayer, Polyline, CircleMarker, GeoJSON, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useRoadNetwork, useSimulationBaseline } from "@/lib/api";
import { useMemo } from "react";

interface SimMapProps {
  variant: "current" | "future";
  scenarioChanges?: any;
  projectGeometry?: any;
}

const bikeTypeColors: Record<string, string> = {
  bike_lane: "#a3e635",
  shared_road: "#f59e0b",
  bike_path: "#22d3ee",
  protected_lane: "#10b981",
};

function segmentStyle(feature: any, variant: "current" | "future") {
  const hasBike = feature?.properties?.hasBikeLane;
  const segType = feature?.properties?.bikeInfraType || "shared_road";
  const color = hasBike ? (bikeTypeColors[segType] || "#a3e635") : "#64748b";
  return {
    color,
    weight: hasBike ? 4 : 2,
    opacity: variant === "future" ? 0.9 : 0.7,
    dashArray: hasBike ? undefined : "6 4",
  };
}

export default function SimMap({ variant, scenarioChanges, projectGeometry }: SimMapProps) {
  const { data: roadNetwork } = useRoadNetwork();
  const { data: baseline } = useSimulationBaseline();

  const displayData = useMemo(() => {
    if (!roadNetwork) return undefined;
    if (variant === "current" || !scenarioChanges) return roadNetwork;

    const features: any[] = roadNetwork.features.map((f) => ({ ...f, properties: { ...f.properties } }));

    if (scenarioChanges.type === "FeatureCollection" && Array.isArray(scenarioChanges.features)) {
      for (const change of scenarioChanges.features) {
        if (change.properties?.action === "upgrade") {
          const targetId = change.properties.segmentId;
          const existing = features.find((f) => f.properties?.id === targetId);
          if (existing) {
            existing.properties.hasBikeLane = true;
            existing.properties.bikeInfraType = change.properties.bikeInfraType || "bike_lane";
          }
        } else {
          features.push({
            ...change,
            properties: {
              ...change.properties,
              hasBikeLane: true,
              bikeInfraType: change.properties?.bikeInfraType || "bike_lane",
              isNew: true,
            },
          });
        }
      }
    }

    return { ...roadNetwork, features };
  }, [roadNetwork, variant, scenarioChanges]);

  const conflictPoints = useMemo(() => {
    if (variant !== "current" || !baseline?.details?.conflictZoneLocations) return [];
    return baseline.details.conflictZoneLocations as { lat: number; lng: number }[];
  }, [variant, baseline]);

  const projGeoKey = useMemo(() => JSON.stringify(projectGeometry), [projectGeometry]);

  return (
    <MapContainer center={[44.4505, 26.12]} zoom={14} className="h-full w-full" zoomControl={false}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {displayData && (
        <GeoJSON
          key={`${variant}-${JSON.stringify(scenarioChanges?.features?.length ?? 0)}`}
          data={displayData as any}
          style={(feature) => segmentStyle(feature, variant)}
          onEachFeature={(feature, layer) => {
            const p = feature.properties;
            if (p) {
              const name = p.name || "Segment";
              const info = p.hasBikeLane ? `🚲 ${p.bikeInfraType || "bike_lane"}` : "Fără pistă";
              layer.bindTooltip(`<strong>${name}</strong><br/>${info}`, { sticky: true });
            }
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

      {/* Conflict zones */}
      {conflictPoints.map((z, i) => (
        <CircleMarker
          key={`conflict-${i}`}
          center={[z.lat, z.lng]}
          radius={12}
          pathOptions={{ color: "#ef4444", fillColor: "#ef4444", fillOpacity: 0.25, weight: 2 }}
        >
          <Tooltip>Zonă de conflict</Tooltip>
        </CircleMarker>
      ))}

      {/* New segments highlight */}
      {variant === "future" && displayData?.features
        .filter((f) => f.properties?.isNew)
        .map((f, i) => {
          if (f.geometry.type === "LineString") {
            const coords = (f.geometry as any).coordinates.map(
              ([lng, lat]: [number, number]) => [lat, lng] as [number, number]
            );
            return (
              <Polyline
                key={`new-${i}`}
                positions={coords}
                pathOptions={{ color: "#a3e635", weight: 6, opacity: 0.5, dashArray: "12 6" }}
              />
            );
          }
          return null;
        })}
    </MapContainer>
  );
}
