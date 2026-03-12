"use client";

import {
  MapContainer,
  TileLayer,
  GeoJSON,
  Polyline,
  CircleMarker,
  Tooltip,
  useMapEvents,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useInfrastructureElements, useRoadNodes } from "@/lib/api";
import { useMemo, useCallback } from "react";

export interface DrawnFeature {
  id: string;
  geometry: { type: "Point" | "LineString"; coordinates: any };
  name: string;
  color: string;
  featureType?: string;
}

const infraColors: Record<string, string> = {
  pista_biciclete: "#a3e635",
  parcare_biciclete: "#22d3ee",
  semafor: "#f59e0b",
  zona_30: "#818cf8",
  zona_pietonala: "#34d399",
};

/** Haversine distance in meters */
function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Snap a lat/lng to the nearest road node within SNAP_RADIUS meters */
function snapToNode(
  lat: number,
  lng: number,
  nodes: { id: string; latitude: number; longitude: number }[],
  snapRadius: number,
): { lat: number; lng: number } {
  let bestDist = Infinity;
  let bestLat = lat;
  let bestLng = lng;
  for (const n of nodes) {
    const d = haversineM(lat, lng, n.latitude, n.longitude);
    if (d < bestDist) {
      bestDist = d;
      bestLat = n.latitude;
      bestLng = n.longitude;
    }
  }
  if (bestDist <= snapRadius) {
    return { lat: bestLat, lng: bestLng };
  }
  return { lat, lng };
}

interface ScenarioEditMapProps {
  scenarioChanges?: any;
  projectGeometry?: any;
  drawnFeatures: DrawnFeature[];
  activeTool: string;
  drawingLine: [number, number][];
  onAddPoint?: (latlng: { lat: number; lng: number }) => void;
  onAddLine?: (coords: [number, number][]) => void;
}

const SNAP_RADIUS = 100; // meters

function MapClickHandler({
  activeTool,
  onAddPoint,
  onAddLine,
  drawingLine,
  roadNodes,
}: {
  activeTool: string;
  onAddPoint?: (latlng: { lat: number; lng: number }) => void;
  onAddLine?: (coords: [number, number][]) => void;
  drawingLine: [number, number][];
  roadNodes: { id: string; latitude: number; longitude: number }[];
}) {
  useMapEvents({
    click(e) {
      if (activeTool === "point" && onAddPoint) {
        const snapped = snapToNode(e.latlng.lat, e.latlng.lng, roadNodes, SNAP_RADIUS);
        onAddPoint(snapped);
      }
      if (activeTool === "line" && onAddLine) {
        const snapped = snapToNode(e.latlng.lat, e.latlng.lng, roadNodes, SNAP_RADIUS);
        onAddLine([...drawingLine, [snapped.lat, snapped.lng]]);
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

/** Show road nodes as small dots when in drawing mode */
function RoadNodeMarkers({ nodes, activeTool }: { nodes: { id: string; latitude: number; longitude: number }[]; activeTool: string }) {
  const map = useMap();
  const zoom = map.getZoom();

  // Only show nodes when actively drawing and zoomed in enough
  if ((activeTool !== "line" && activeTool !== "point") || zoom < 15) return null;

  // Filter to visible bounds to avoid rendering thousands
  const bounds = map.getBounds();
  const visible = nodes.filter(
    (n) =>
      n.latitude >= bounds.getSouth() &&
      n.latitude <= bounds.getNorth() &&
      n.longitude >= bounds.getWest() &&
      n.longitude <= bounds.getEast()
  );

  return (
    <>
      {visible.map((n) => (
        <CircleMarker
          key={`node-${n.id}`}
          center={[n.latitude, n.longitude]}
          radius={3}
          pathOptions={{
            color: "#60a5fa",
            fillColor: "#3b82f6",
            fillOpacity: 0.5,
            weight: 1,
          }}
        />
      ))}
    </>
  );
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
  const { data: roadNodes } = useRoadNodes();

  const infraPolylines = useMemo(() => {
    return (infraElements ?? []).filter((e: any) => e.geometry?.type === "LineString");
  }, [infraElements]);

  const infraPoints = useMemo(() => {
    return (infraElements ?? []).filter((e: any) => e.geometry?.type === "Point");
  }, [infraElements]);

  const nodesList = useMemo(() => roadNodes ?? [], [roadNodes]);

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
        roadNodes={nodesList}
      />

      {/* Road nodes visualization during drawing */}
      <RoadNodeMarkers nodes={nodesList} activeTool={activeTool} />

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
