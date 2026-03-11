"use client";

import { MapContainer, TileLayer, Polyline, CircleMarker } from "react-leaflet";
import "leaflet/dist/leaflet.css";

// Current infrastructure - sparse (Sector 2, București)
const currentRoutes: [number, number][][] = [
  [
    [44.4380, 26.1160],
    [44.4400, 26.1200],
  ],
  [
    [44.4460, 26.1100],
    [44.4480, 26.1150],
  ],
];

// Future infrastructure - expanded network
const futureRoutes: Record<string, [number, number][][]> = {
  s1: [
    ...currentRoutes,
    [
      [44.4400, 26.1200],
      [44.4460, 26.1100],
    ],
    [
      [44.4350, 26.1130],
      [44.4380, 26.1160],
      [44.4420, 26.1180],
      [44.4460, 26.1200],
    ],
    [
      [44.4480, 26.1150],
      [44.4505, 26.1255],
      [44.4530, 26.1300],
    ],
    [
      [44.4370, 26.1250],
      [44.4400, 26.1200],
      [44.4460, 26.1100],
      [44.4500, 26.1060],
    ],
  ],
  s2: [
    ...currentRoutes,
    [
      [44.4400, 26.1200],
      [44.4450, 26.1250],
    ],
  ],
  s3: [
    ...currentRoutes,
    [
      [44.4400, 26.1200],
      [44.4460, 26.1100],
    ],
    [
      [44.4370, 26.1130],
      [44.4400, 26.1200],
    ],
    [
      [44.4480, 26.1150],
      [44.4520, 26.1200],
    ],
  ],
};

const dangerZones: { lat: number; lng: number; label: string }[] = [
  { lat: 44.4420, lng: 26.1160, label: "Intersecție periculoasă" },
  { lat: 44.4505, lng: 26.1255, label: "Trafic intens" },
  { lat: 44.4370, lng: 26.1130, label: "Vizibilitate redusă" },
];

interface SimMapProps {
  variant: "current" | "future";
  scenarioId?: string;
}

export default function SimMap({ variant, scenarioId }: SimMapProps) {
  const routes = variant === "current" ? currentRoutes : (scenarioId ? futureRoutes[scenarioId] || currentRoutes : currentRoutes);

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
