"use client";

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, CircleMarker, Polyline, Popup } from "react-leaflet";
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

// Mock infrastructure elements with coordinates in Cluj-Napoca
const mockElements: {
  id: string;
  layerId: string;
  name: string;
  type: string;
  lat: number;
  lng: number;
  properties: Record<string, string>;
}[] = [
  { id: "e1", layerId: "l2", name: "Parcare Piața Unirii", type: "Parcare biciclete", lat: 46.7712, lng: 23.5897, properties: { Capacitate: "20", Stare: "Bună" } },
  { id: "e2", layerId: "l2", name: "Parcare Gara CFR", type: "Parcare biciclete", lat: 46.7685, lng: 23.5892, properties: { Capacitate: "35", Stare: "Nouă" } },
  { id: "e3", layerId: "l3", name: "Semafor Bicicliști Memorandumului", type: "Semafor", lat: 46.7695, lng: 23.5888, properties: { Tip: "Cu buton", An: "2023" } },
  { id: "e4", layerId: "l3", name: "Semafor B-dul 21 Dec", type: "Semafor", lat: 46.7720, lng: 23.5950, properties: { Tip: "Automat", An: "2024" } },
  { id: "e5", layerId: "l2", name: "Parcare UBBR", type: "Parcare biciclete", lat: 46.7665, lng: 23.5910, properties: { Capacitate: "15", Stare: "Bună" } },
];

const mockPolylines: {
  id: string;
  layerId: string;
  name: string;
  type: string;
  coords: [number, number][];
  properties: Record<string, string>;
}[] = [
  {
    id: "p1",
    layerId: "l1",
    name: "Pistă Memorandumului",
    type: "Pistă biciclete",
    coords: [
      [46.7695, 23.5850],
      [46.7698, 23.5870],
      [46.7700, 23.5895],
      [46.7703, 23.5920],
    ],
    properties: { Lungime: "850m", Lățime: "1.5m", Material: "Asfalt" },
  },
  {
    id: "p2",
    layerId: "l1",
    name: "Pistă B-dul Eroilor",
    type: "Pistă biciclete",
    coords: [
      [46.7710, 23.5870],
      [46.7715, 23.5880],
      [46.7720, 23.5895],
      [46.7725, 23.5910],
      [46.7730, 23.5925],
    ],
    properties: { Lungime: "1.2km", Lățime: "2m", Material: "Beton" },
  },
];

interface InfraMapProps {
  layers: InfraLayer[];
  activeTool: string;
  onSelectElement: (el: SelectedElement) => void;
}

export default function InfraMap({ layers, activeTool, onSelectElement }: InfraMapProps) {
  const visibleLayerIds = layers.filter((l) => l.visible).map((l) => l.id);
  const layerColorMap = Object.fromEntries(layers.map((l) => [l.id, l.color]));

  const visiblePoints = mockElements.filter((e) => visibleLayerIds.includes(e.layerId));
  const visibleLines = mockPolylines.filter((p) => visibleLayerIds.includes(p.layerId));

  return (
    <MapContainer
      center={[46.7712, 23.5897]}
      zoom={15}
      className="h-full w-full"
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />

      {/* Polylines for bike lanes etc. */}
      {visibleLines.map((line) => (
        <Polyline
          key={line.id}
          positions={line.coords}
          pathOptions={{
            color: layerColorMap[line.layerId] || "#a3e635",
            weight: 4,
            opacity: 0.8,
          }}
          eventHandlers={{
            click: () =>
              onSelectElement({
                id: line.id,
                name: line.name,
                type: line.type,
                properties: line.properties,
              }),
          }}
        >
          <Popup>
            <div className="text-xs">
              <strong>{line.name}</strong>
              <br />
              {line.type}
            </div>
          </Popup>
        </Polyline>
      ))}

      {/* Points for markers, signals, etc. */}
      {visiblePoints.map((el) => (
        <CircleMarker
          key={el.id}
          center={[el.lat, el.lng]}
          radius={8}
          pathOptions={{
            color: layerColorMap[el.layerId] || "#00d4ff",
            fillColor: layerColorMap[el.layerId] || "#00d4ff",
            fillOpacity: 0.6,
            weight: 2,
          }}
          eventHandlers={{
            click: () =>
              onSelectElement({
                id: el.id,
                name: el.name,
                type: el.type,
                properties: el.properties,
              }),
          }}
        >
          <Popup>
            <div className="text-xs">
              <strong>{el.name}</strong>
              <br />
              {el.type}
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
