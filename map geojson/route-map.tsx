"use client";

import { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  CircleMarker,
  useMap,
  useMapEvents,
} from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import "leaflet/dist/leaflet.css";

type LatLng = { lat: number; lng: number };

type NetworkType = "principala" | "secundara";

export interface NetworkPolyline {
  coords: LatLng[];
  type: NetworkType;
}

interface BikeRouteMapProps {
  networkPolylines: NetworkPolyline[];
  startPoint: LatLng | null;
  endPoint: LatLng | null;
  bikeRoute: LatLng[];
  accessRoute: LatLng[];
  egressRoute: LatLng[];
  onMapClick: (point: LatLng) => void;
}

function RouteFitter({
  bikeRoute,
  accessRoute,
  egressRoute,
}: {
  bikeRoute: LatLng[];
  accessRoute: LatLng[];
  egressRoute: LatLng[];
}) {
  const map = useMap();

  useEffect(() => {
    const allPoints: LatLng[] = [];
    allPoints.push(...bikeRoute, ...accessRoute, ...egressRoute);
    if (!allPoints.length) return;
    const bounds = allPoints.map((p) => [p.lat, p.lng]) as LatLngExpression[];
    map.fitBounds(bounds, { padding: [48, 48] });
  }, [bikeRoute, accessRoute, egressRoute, map]);

  return null;
}

function DestinationPicker({ onSelect }: { onSelect: (p: LatLng) => void }) {
  useMapEvents({
    click(e) {
      onSelect({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

export function BikeRouteMap({
  networkPolylines,
  startPoint,
  endPoint,
  bikeRoute,
  accessRoute,
  egressRoute,
  onMapClick,
}: BikeRouteMapProps) {
  const center: LatLngExpression = [44.437, 26.096]; // București central

  return (
    <MapContainer
      center={center}
      zoom={13}
      style={{ height: "100%", width: "100%" }}
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />

      <DestinationPicker onSelect={onMapClick} />

      {networkPolylines.map((line, idx) => (
        <Polyline
          key={idx}
          positions={line.coords.map((c) => [c.lat, c.lng]) as LatLngExpression[]}
          pathOptions={{
            color: line.type === "principala" ? "#22c55e" : "#3b82f6",
            weight: line.type === "principala" ? 4 : 3,
            opacity: 0.7,
          }}
        />
      ))}

      {accessRoute.length > 1 && (
        <>
          <Polyline
            positions={accessRoute.map((c) => [c.lat, c.lng]) as LatLngExpression[]}
            pathOptions={{
              color: "#9ca3af",
              weight: 4,
              opacity: 0.8,
              dashArray: "6 6",
            }}
          />
        </>
      )}

      {egressRoute.length > 1 && (
        <Polyline
          positions={egressRoute.map((c) => [c.lat, c.lng]) as LatLngExpression[]}
          pathOptions={{
            color: "#9ca3af",
            weight: 4,
            opacity: 0.8,
            dashArray: "6 6",
          }}
        />
      )}

      {bikeRoute.length > 1 && (
        <>
          <Polyline
            positions={bikeRoute.map((c) => [c.lat, c.lng]) as LatLngExpression[]}
            pathOptions={{
              color: "#eab308",
              weight: 6,
              opacity: 0.9,
            }}
          />
          <RouteFitter
            bikeRoute={bikeRoute}
            accessRoute={accessRoute}
            egressRoute={egressRoute}
          />
        </>
      )}

      {startPoint && (
        <CircleMarker
          center={[startPoint.lat, startPoint.lng]}
          radius={7}
          pathOptions={{
            color: "#22c55e",
            fillColor: "#22c55e",
            fillOpacity: 0.9,
            weight: 2,
          }}
        />
      )}

      {endPoint && (
        <CircleMarker
          center={[endPoint.lat, endPoint.lng]}
          radius={7}
          pathOptions={{
            color: "#ef4444",
            fillColor: "#ef4444",
            fillOpacity: 0.9,
            weight: 2,
          }}
        />
      )}
    </MapContainer>
  );
}

