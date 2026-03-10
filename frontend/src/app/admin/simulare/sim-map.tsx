"use client";

import { MapContainer, TileLayer, Polyline, CircleMarker } from "react-leaflet";
import "leaflet/dist/leaflet.css";

// Current infrastructure - sparse
const currentRoutes: [number, number][][] = [
  [
    [46.7695, 23.5850],
    [46.7700, 23.5895],
  ],
  [
    [46.7715, 23.5880],
    [46.7725, 23.5910],
  ],
];

// Future infrastructure - expanded network
const futureRoutes: Record<string, [number, number][][]> = {
  s1: [
    ...currentRoutes,
    [
      [46.7700, 23.5895],
      [46.7715, 23.5880],
    ],
    [
      [46.7680, 23.5860],
      [46.7695, 23.5850],
      [46.7710, 23.5845],
      [46.7725, 23.5855],
    ],
    [
      [46.7725, 23.5910],
      [46.7730, 23.5935],
      [46.7728, 23.5960],
    ],
    [
      [46.7690, 23.5920],
      [46.7700, 23.5895],
      [46.7715, 23.5880],
      [46.7730, 23.5870],
    ],
  ],
  s2: [
    ...currentRoutes,
    [
      [46.7700, 23.5895],
      [46.7710, 23.5920],
    ],
  ],
  s3: [
    ...currentRoutes,
    [
      [46.7700, 23.5895],
      [46.7715, 23.5880],
    ],
    [
      [46.7690, 23.5870],
      [46.7700, 23.5895],
    ],
    [
      [46.7725, 23.5910],
      [46.7735, 23.5930],
    ],
  ],
};

const dangerZones: { lat: number; lng: number; label: string }[] = [
  { lat: 46.7705, lng: 23.5885, label: "Intersecție periculoasă" },
  { lat: 46.7720, lng: 23.5905, label: "Trafic intens" },
  { lat: 46.7690, lng: 23.5870, label: "Vizibilitate redusă" },
];

interface SimMapProps {
  variant: "current" | "future";
  scenarioId?: string;
}

export default function SimMap({ variant, scenarioId }: SimMapProps) {
  const routes = variant === "current" ? currentRoutes : (scenarioId ? futureRoutes[scenarioId] || currentRoutes : currentRoutes);

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
      {routes.map((coords, i) => (
        <Polyline
          key={`${variant}-${i}`}
          positions={coords}
          pathOptions={{
            color: variant === "current" ? "#f59e0b" : "#a3e635",
            weight: variant === "future" ? 5 : 3,
            opacity: 0.8,
            dashArray: variant === "current" ? "8 4" : undefined,
          }}
        />
      ))}
      {variant === "current" &&
        dangerZones.map((z, i) => (
          <CircleMarker
            key={i}
            center={[z.lat, z.lng]}
            radius={12}
            pathOptions={{
              color: "#ef4444",
              fillColor: "#ef4444",
              fillOpacity: 0.25,
              weight: 2,
            }}
          />
        ))}
    </MapContainer>
  );
}
