"use client";

import { useEffect, useRef, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Polyline,
  Polygon,
  Popup,
  GeoJSON,
  useMapEvents,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

interface InfraLayer {
  id: string;
  type: string;
  label: string;
  color: string;
  visible: boolean;
  count: number;
}

interface SelectedElement {
  id: string;
  name: string;
  type: string;
  properties: Record<string, string>;
}

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

interface InfraMapProps {
  layers: InfraLayer[];
  elements: InfraElement[];
  activeTool: string;
  onSelectElement: (el: SelectedElement) => void;
  onAddPoint?: (latlng: { lat: number; lng: number }) => void;
  onAddLine?: (coords: [number, number][]) => void;
  drawingLine: [number, number][];
  projectGeometry?: any;
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
      // Double click finishes line drawing, prevent default zoom
      if (activeTool === "line" && drawingLine.length >= 2) {
        e.originalEvent.preventDefault();
      }
    },
  });
  return null;
}

export default function InfraMap({
  layers,
  elements,
  activeTool,
  onSelectElement,
  onAddPoint,
  onAddLine,
  drawingLine,
  projectGeometry,
}: InfraMapProps) {
  const visibleLayerIds = layers.filter((l) => l.visible).map((l) => l.id);
  const layerColorMap = Object.fromEntries(layers.map((l) => [l.id, l.color]));

  const visibleElements = elements.filter((e) => visibleLayerIds.includes(e.layerId));
  const points = visibleElements.filter((e) => e.geometry?.type === "Point");
  const lines = visibleElements.filter((e) => e.geometry?.type === "LineString");
  const polygons = visibleElements.filter((e) => e.geometry?.type === "Polygon");

  const toProps = (el: InfraElement): Record<string, string> => {
    const raw = el.properties || {};
    const result: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) result[k] = String(v);
    return result;
  };

  // Project geometry key for re-rendering GeoJSON
  const geoKey = useMemo(() => JSON.stringify(projectGeometry), [projectGeometry]);

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

      {/* Project geometry overlay */}
      {projectGeometry && (
        <GeoJSON
          key={geoKey}
          data={projectGeometry}
          style={() => ({
            color: "#a855f7",
            weight: 4,
            opacity: 0.5,
            dashArray: "8 4",
            fillOpacity: 0.1,
          })}
        />
      )}

      {/* Drawing preview for line tool */}
      {drawingLine.length >= 2 && (
        <Polyline
          positions={drawingLine}
          pathOptions={{ color: "#f59e0b", weight: 4, dashArray: "6 4" }}
        />
      )}
      {drawingLine.length >= 1 && drawingLine.map((pos, i) => (
        <CircleMarker
          key={`draw-${i}`}
          center={pos}
          radius={5}
          pathOptions={{ color: "#f59e0b", fillColor: "#f59e0b", fillOpacity: 1, weight: 2 }}
        />
      ))}

      {/* Polygons */}
      {polygons.map((el) => {
        const coords = el.geometry.coordinates[0]?.map((c: number[]) => [c[1], c[0]]) || [];
        return (
          <Polygon
            key={el.id}
            positions={coords}
            pathOptions={{ color: layerColorMap[el.layerId] || "#a3e635", fillOpacity: 0.3, weight: 2 }}
            eventHandlers={{ click: () => onSelectElement({ id: el.id, name: el.name, type: el.typeLabel, properties: toProps(el) }) }}
          >
            <Popup autoClose closeOnClick><div className="text-xs"><strong>{el.name}</strong><br />{el.typeLabel}</div></Popup>
          </Polygon>
        );
      })}

      {/* Lines */}
      {lines.map((el) => {
        const coords = el.geometry.coordinates?.map((c: number[]) => [c[1], c[0]]) || [];
        return (
          <Polyline
            key={el.id}
            positions={coords}
            pathOptions={{ color: layerColorMap[el.layerId] || "#a3e635", weight: 4, opacity: 0.8 }}
            eventHandlers={{ click: () => onSelectElement({ id: el.id, name: el.name, type: el.typeLabel, properties: toProps(el) }) }}
          >
            <Popup autoClose closeOnClick><div className="text-xs"><strong>{el.name}</strong><br />{el.typeLabel}</div></Popup>
          </Polyline>
        );
      })}

      {/* Points */}
      {points.map((el) => {
        const [lng, lat] = el.geometry.coordinates;
        return (
          <CircleMarker
            key={el.id}
            center={[lat, lng]}
            radius={8}
            pathOptions={{ color: layerColorMap[el.layerId] || "#00d4ff", fillColor: layerColorMap[el.layerId] || "#00d4ff", fillOpacity: 0.6, weight: 2 }}
            eventHandlers={{ click: () => onSelectElement({ id: el.id, name: el.name, type: el.typeLabel, properties: toProps(el) }) }}
          >
            <Popup autoClose closeOnClick><div className="text-xs"><strong>{el.name}</strong><br />{el.typeLabel}</div></Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
