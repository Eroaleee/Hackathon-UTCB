"use client";

import { useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Polyline,
  Polygon,
  Marker,
  GeoJSON,
  Tooltip,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface InfraElement {
  id: string;
  layerId: string;
  type: string;
  typeLabel: string;
  name: string;
  geometry: any;
  properties: any;
  layer?: { id: string; type: string; label: string; color: string; icon: string };
}

interface InfraLayer {
  id: string;
  type: string;
  label: string;
  color: string;
  visible: boolean;
}

interface ProposalDrawMapProps {
  /** Currently active tool */
  activeTool: "select" | "point" | "line";
  /** Points placed on the map */
  points: [number, number][];
  /** Completed lines */
  lines: [number, number][][];
  /** Line currently being drawn */
  drawingLine: [number, number][];
  /** Center pin lat/lng for proposal location */
  centerLat: number;
  centerLng: number;
  /** Callbacks */
  onAddPoint: (latlng: [number, number]) => void;
  onAddLinePoint: (latlng: [number, number]) => void;
  onLocationChange: (lat: number, lng: number) => void;
  /** Optional: existing geometry to display (when viewing a proposal) */
  existingGeometry?: any;
  /** Optional: infrastructure layers & elements to render */
  infraLayers?: InfraLayer[];
  infraElements?: InfraElement[];
}

const pinIcon = L.divIcon({
  className: "",
  html: `<div style="width:24px;height:24px;position:relative">
    <div style="width:24px;height:24px;background:#00d4ff;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.4)"></div>
  </div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 24],
});

function ClickHandler({
  activeTool,
  onAddPoint,
  onAddLinePoint,
  onLocationChange,
}: {
  activeTool: string;
  onAddPoint: (latlng: [number, number]) => void;
  onAddLinePoint: (latlng: [number, number]) => void;
  onLocationChange: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      if (activeTool === "point") {
        onAddPoint([lat, lng]);
      } else if (activeTool === "line") {
        onAddLinePoint([lat, lng]);
      } else {
        onLocationChange(lat, lng);
      }
    },
  });
  return null;
}

export default function ProposalDrawMap({
  activeTool,
  points,
  lines,
  drawingLine,
  centerLat,
  centerLng,
  onAddPoint,
  onAddLinePoint,
  onLocationChange,
  existingGeometry,
  infraLayers = [],
  infraElements = [],
}: ProposalDrawMapProps) {
  const geoKey = useMemo(() => JSON.stringify(existingGeometry), [existingGeometry]);

  // Infrastructure rendering
  const visibleLayerIds = infraLayers.filter((l) => l.visible).map((l) => l.id);
  const layerColorMap = Object.fromEntries(infraLayers.map((l) => [l.id, l.color]));
  const visibleInfra = infraElements.filter((e) => visibleLayerIds.includes(e.layerId));
  const infraPoints = visibleInfra.filter((e) => e.geometry?.type === "Point");
  const infraLines = visibleInfra.filter((e) => e.geometry?.type === "LineString");
  const infraPolygons = visibleInfra.filter((e) => e.geometry?.type === "Polygon");

  return (
    <MapContainer
      center={[centerLat, centerLng]}
      zoom={14}
      className="h-full w-full"
      zoomControl={false}
      doubleClickZoom={activeTool !== "line"}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickHandler
        activeTool={activeTool}
        onAddPoint={onAddPoint}
        onAddLinePoint={onAddLinePoint}
        onLocationChange={onLocationChange}
      />

      {/* Center marker (proposal location) */}
      <Marker position={[centerLat, centerLng]} icon={pinIcon} />

      {/* Drawn points (infrastructure markers) */}
      {points.map((pos, i) => (
        <CircleMarker
          key={`pt-${i}`}
          center={pos}
          radius={8}
          pathOptions={{ color: "#a3e635", fillColor: "#a3e635", fillOpacity: 0.8, weight: 2 }}
        />
      ))}

      {/* Completed lines */}
      {lines.map((line, i) => (
        <Polyline
          key={`line-${i}`}
          positions={line}
          pathOptions={{ color: "#a3e635", weight: 4, opacity: 0.9 }}
        />
      ))}

      {/* Line currently being drawn */}
      {drawingLine.length >= 2 && (
        <Polyline
          positions={drawingLine}
          pathOptions={{ color: "#f59e0b", weight: 4, dashArray: "6 4" }}
        />
      )}
      {drawingLine.map((pos, i) => (
        <CircleMarker
          key={`draw-${i}`}
          center={pos}
          radius={5}
          pathOptions={{ color: "#f59e0b", fillColor: "#f59e0b", fillOpacity: 1, weight: 2 }}
        />
      ))}

      {/* Infrastructure layers */}
      {infraPolygons.map((el) => {
        const coords = el.geometry.coordinates[0]?.map((c: number[]) => [c[1], c[0]]) || [];
        return (
          <Polygon
            key={`infra-poly-${el.id}`}
            positions={coords}
            pathOptions={{ color: layerColorMap[el.layerId] || "#a3e635", fillOpacity: 0.15, weight: 2, opacity: 0.6 }}
          >
            <Tooltip sticky><span className="text-xs">{el.name}</span></Tooltip>
          </Polygon>
        );
      })}
      {infraLines.map((el) => {
        const coords = el.geometry.coordinates?.map((c: number[]) => [c[1], c[0]]) || [];
        return (
          <Polyline
            key={`infra-line-${el.id}`}
            positions={coords}
            pathOptions={{ color: layerColorMap[el.layerId] || "#a3e635", weight: 3, opacity: 0.6 }}
          >
            <Tooltip sticky><span className="text-xs">{el.name}</span></Tooltip>
          </Polyline>
        );
      })}
      {infraPoints.map((el) => {
        const [lng, lat] = el.geometry.coordinates;
        return (
          <CircleMarker
            key={`infra-pt-${el.id}`}
            center={[lat, lng]}
            radius={6}
            pathOptions={{ color: layerColorMap[el.layerId] || "#00d4ff", fillColor: layerColorMap[el.layerId] || "#00d4ff", fillOpacity: 0.5, weight: 2, opacity: 0.6 }}
          >
            <Tooltip><span className="text-xs">{el.name}</span></Tooltip>
          </CircleMarker>
        );
      })}

      {/* Existing geometry (for viewing proposals) */}
      {existingGeometry && (
        <GeoJSON
          key={geoKey}
          data={existingGeometry}
          style={() => ({
            color: "#a3e635",
            weight: 4,
            opacity: 0.8,
            fillOpacity: 0.2,
          })}
        />
      )}
    </MapContainer>
  );
}
