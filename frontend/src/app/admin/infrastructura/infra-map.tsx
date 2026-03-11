"use client";

import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Polyline, Polygon, Popup, useMapEvents } from "react-leaflet";
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
}

function MapClickHandler({ activeTool, onAddPoint }: { activeTool: string; onAddPoint?: (latlng: { lat: number; lng: number }) => void }) {
  useMapEvents({
    click(e) {
      if (activeTool === "point" && onAddPoint) {
        onAddPoint({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
    },
  });
  return null;
}

export default function InfraMap({ layers, elements, activeTool, onSelectElement, onAddPoint }: InfraMapProps) {
  const visibleLayerIds = layers.filter((l) => l.visible).map((l) => l.id);
  const layerColorMap = Object.fromEntries(layers.map((l) => [l.id, l.color]));

  const visibleElements = elements.filter((e) => visibleLayerIds.includes(e.layerId));

  // Separate points vs lines/polygons based on geometry type
  const points = visibleElements.filter((e) => e.geometry?.type === "Point");
  const lines = visibleElements.filter((e) => e.geometry?.type === "LineString");
  const polygons = visibleElements.filter((e) => e.geometry?.type === "Polygon");

  const toProps = (el: InfraElement): Record<string, string> => {
    const raw = el.properties || {};
    const result: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) {
      result[k] = String(v);
    }
    return result;
  };

  return (
    <MapContainer
      center={[44.4505, 26.1200]}
      zoom={14}
      className="h-full w-full"
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      <MapClickHandler activeTool={activeTool} onAddPoint={onAddPoint} />

      {/* Polygons */}
      {polygons.map((el) => {
        const coords = el.geometry.coordinates[0]?.map((c: number[]) => [c[1], c[0]]) || [];
        return (
          <Polygon
            key={el.id}
            positions={coords}
            pathOptions={{
              color: layerColorMap[el.layerId] || "#a3e635",
              fillOpacity: 0.3,
              weight: 2,
            }}
            eventHandlers={{
              click: () => onSelectElement({ id: el.id, name: el.name, type: el.typeLabel, properties: toProps(el) }),
            }}
          >
            <Popup><div className="text-xs"><strong>{el.name}</strong><br />{el.typeLabel}</div></Popup>
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
            pathOptions={{
              color: layerColorMap[el.layerId] || "#a3e635",
              weight: 4,
              opacity: 0.8,
            }}
            eventHandlers={{
              click: () => onSelectElement({ id: el.id, name: el.name, type: el.typeLabel, properties: toProps(el) }),
            }}
          >
            <Popup><div className="text-xs"><strong>{el.name}</strong><br />{el.typeLabel}</div></Popup>
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
            pathOptions={{
              color: layerColorMap[el.layerId] || "#00d4ff",
              fillColor: layerColorMap[el.layerId] || "#00d4ff",
              fillOpacity: 0.6,
              weight: 2,
            }}
            eventHandlers={{
              click: () => onSelectElement({ id: el.id, name: el.name, type: el.typeLabel, properties: toProps(el) }),
            }}
          >
            <Popup><div className="text-xs"><strong>{el.name}</strong><br />{el.typeLabel}</div></Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
