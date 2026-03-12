"use client";

import {
  MapContainer,
  TileLayer,
  GeoJSON,
  Polyline,
  CircleMarker,
  Tooltip,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useInfrastructureElements } from "@/lib/api";
import { useMemo } from "react";

export interface DrawnFeature {
  id: string;
  geometry: { type: "Point" | "LineString"; coordinates: any };
  name: string;
  color: string;
}

const infraColors: Record<string, string> = {
  bike_lane: "#a3e635",
  bike_parking: "#22d3ee",
  bike_signal: "#f59e0b",
  shared_lane: "#818cf8",
};

interface ScenarioEditMapProps {
  scenarioChanges?: any;
  projectGeometry?: any;
  drawnFeatures: DrawnFeature[];
  activeTool: string;
  drawingLine: [number, number][];
  onAddPoint?: (latlng: { lat: number; lng: number }) => void;
  onAddLine?: (coords: [number, number][]) => void;
}

function MapClickHandler({
  activeTool,
  onAddPoint,
  onAddLine,
  drawingLine,
}: {
  activeTool: string;
  onAddPoint?: (latlng: { lat: number; lng: number }) => void;
  onAddLine?: (coords: [number, number][]) => void;
  drawingLine: [number, number][];
}) {
  useMapEvents({
    click(e) {
      if (activeTool === "point" && onAddPoint) {
        onAddPoint({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
      if (activeTool === "line" && onAddLine) {
        onAddLine([...drawingLine, [e.latlng.lat, e.latlng.lng]]);
      }
    },
    dblclick(e) {
      if (activeTool === "line" && drawingLine.length >= 2) {
        e.originalEvent.preventDefault();
      }
    },
  });
  return null;
}

export default function ScenarioEditMap({
  scenarioChanges,
  projectGeometry,
  drawnFeatures,
  activeTool,
  drawingLine,
  onAddPoint,
  onAddLine,
}: ScenarioEditMapProps) {
  const { data: infraElements } = useInfrastructureElements();

  const infraPolylines = useMemo(() => {
    return (infraElements ?? []).filter((e: any) => e.geometry?.type === "LineString");
  }, [infraElements]);

  const infraPoints = useMemo(() => {
    return (infraElements ?? []).filter((e: any) => e.geometry?.type === "Point");
  }, [infraElements]);

  const projGeoKey = useMemo(
    () => JSON.stringify(projectGeometry),
    [projectGeometry]
  );
  const drawnKey = useMemo(
    () => JSON.stringify(drawnFeatures.map((f) => f.id)),
    [drawnFeatures]
  );

  return (
    <MapContainer
      center={[44.4505, 26.12]}
      zoom={14}
      className="h-full w-full"
      zoomControl={false}
      doubleClickZoom={activeTool === "line" ? false : true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapClickHandler
        activeTool={activeTool}
        onAddPoint={onAddPoint}
        onAddLine={onAddLine}
        drawingLine={drawingLine}
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
              opacity: 0.6,
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

      {/* Project geometry overlay */}
      {projectGeometry && (
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

      {/* Drawn features (session) */}
      {drawnFeatures.map((feat) => {
        if (feat.geometry.type === "Point") {
          const [lng, lat] = feat.geometry.coordinates;
          return (
            <CircleMarker
              key={feat.id}
              center={[lat, lng]}
              radius={8}
              pathOptions={{
                color: feat.color,
                fillColor: feat.color,
                fillOpacity: 0.7,
                weight: 2,
              }}
            >
              <Tooltip>{feat.name || "Punct nou"}</Tooltip>
            </CircleMarker>
          );
        }
        if (feat.geometry.type === "LineString") {
          const coords = feat.geometry.coordinates.map(
            ([lng, lat]: [number, number]) => [lat, lng] as [number, number]
          );
          return (
            <Polyline
              key={feat.id}
              positions={coords}
              pathOptions={{
                color: feat.color,
                weight: 4,
                opacity: 0.9,
              }}
            >
              <Tooltip sticky>{feat.name || "Linie nouă"}</Tooltip>
            </Polyline>
          );
        }
        return null;
      })}

      {/* Drawing preview for line tool */}
      {drawingLine.length >= 2 && (
        <Polyline
          positions={drawingLine}
          pathOptions={{ color: "#f59e0b", weight: 4, dashArray: "6 4" }}
        />
      )}
      {drawingLine.length >= 1 &&
        drawingLine.map((pos, i) => (
          <CircleMarker
            key={`draw-${i}`}
            center={pos}
            radius={5}
            pathOptions={{
              color: "#f59e0b",
              fillColor: "#f59e0b",
              fillOpacity: 1,
              weight: 2,
            }}
          />
        ))}
    </MapContainer>
  );
}
