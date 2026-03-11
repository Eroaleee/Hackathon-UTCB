"use client";

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import type { Report, MapLayer } from "@/types";
import "leaflet/dist/leaflet.css";

interface MapViewProps {
  reports: Report[];
  layers: MapLayer[];
  onReportClick: (id: string) => void;
}

const severityColors: Record<string, string> = {
  scazut: "#3b82f6",
  mediu: "#eab308",
  ridicat: "#f97316",
  critic: "#ef4444",
};

const statusColors: Record<string, string> = {
  trimis: "#94a3b8",
  in_analiza: "#06b6d4",
  in_lucru: "#f59e0b",
  rezolvat: "#22c55e",
  respins: "#ef4444",
};

export default function MapView({ reports, layers, onReportClick }: MapViewProps) {
  const showHeatmap = layers.find((l) => l.id === "heatmap_pericole")?.visible;

  return (
    <MapContainer
      center={[44.4505, 26.1200]}
      zoom={14}
      style={{ height: "100%", width: "100%" }}
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />

      {showHeatmap &&
        reports.map((report) => (
          <CircleMarker
            key={report.id}
            center={[report.location.lat, report.location.lng]}
            radius={report.severity === "critic" ? 12 : report.severity === "ridicat" ? 10 : report.severity === "mediu" ? 8 : 6}
            pathOptions={{
              fillColor: severityColors[report.severity],
              color: severityColors[report.severity],
              weight: 2,
              opacity: 0.8,
              fillOpacity: 0.4,
            }}
            eventHandlers={{
              click: () => onReportClick(report.id),
            }}
          >
            <Popup autoClose closeOnClick>
              <div className="text-xs">
                <p className="font-bold">{report.title}</p>
                <p>{report.categoryLabel}</p>
              </div>
            </Popup>
          </CircleMarker>
        ))}
    </MapContainer>
  );
}
