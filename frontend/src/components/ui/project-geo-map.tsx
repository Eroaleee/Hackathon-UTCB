"use client";

import { useMemo } from "react";
import { MapContainer, TileLayer, CircleMarker, Polyline, Polygon, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

interface ProjectGeoMapProps {
  geometry: any; // GeoJSON FeatureCollection
  className?: string;
}

const COLORS = ["#a3e635", "#00d4ff", "#f59e0b", "#a855f7", "#f43f5e"];

function getCenter(geometry: any): [number, number] {
  if (!geometry?.features?.length) return [44.4505, 26.1200];
  const coords: [number, number][] = [];
  for (const f of geometry.features) {
    const g = f.geometry;
    if (g.type === "Point") {
      coords.push([g.coordinates[1], g.coordinates[0]]);
    } else if (g.type === "LineString") {
      for (const c of g.coordinates) coords.push([c[1], c[0]]);
    } else if (g.type === "Polygon") {
      for (const c of g.coordinates[0]) coords.push([c[1], c[0]]);
    }
  }
  if (!coords.length) return [44.4505, 26.1200];
  const avgLat = coords.reduce((s, c) => s + c[0], 0) / coords.length;
  const avgLng = coords.reduce((s, c) => s + c[1], 0) / coords.length;
  return [avgLat, avgLng];
}

export default function ProjectGeoMap({ geometry, className }: ProjectGeoMapProps) {
  const center = useMemo(() => getCenter(geometry), [geometry]);
  const features = geometry?.features || [];

  const points = features.filter((f: any) => f.geometry?.type === "Point");
  const lines = features.filter((f: any) => f.geometry?.type === "LineString");
  const polygons = features.filter((f: any) => f.geometry?.type === "Polygon");

  return (
    <MapContainer
      center={center}
      zoom={14}
      className={className || "h-48 w-full rounded-lg"}
      zoomControl={false}
      scrollWheelZoom={false}
      dragging={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />

      {polygons.map((f: any, i: number) => {
        const coords = f.geometry.coordinates[0]?.map((c: number[]) => [c[1], c[0]]) || [];
        return (
          <Polygon
            key={`poly-${i}`}
            positions={coords}
            pathOptions={{ color: COLORS[i % COLORS.length], fillOpacity: 0.25, weight: 2 }}
          >
            <Popup autoClose closeOnClick><div className="text-xs"><strong>{f.properties?.name || "Zonă"}</strong></div></Popup>
          </Polygon>
        );
      })}

      {lines.map((f: any, i: number) => {
        const coords = f.geometry.coordinates?.map((c: number[]) => [c[1], c[0]]) || [];
        return (
          <Polyline
            key={`line-${i}`}
            positions={coords}
            pathOptions={{ color: COLORS[i % COLORS.length], weight: 4, opacity: 0.85 }}
          >
            <Popup autoClose closeOnClick><div className="text-xs"><strong>{f.properties?.name || "Traseu"}</strong></div></Popup>
          </Polyline>
        );
      })}

      {points.map((f: any, i: number) => {
        const [lng, lat] = f.geometry.coordinates;
        return (
          <CircleMarker
            key={`pt-${i}`}
            center={[lat, lng]}
            radius={7}
            pathOptions={{ color: "#00d4ff", fillColor: "#00d4ff", fillOpacity: 0.7, weight: 2 }}
          >
            <Popup autoClose closeOnClick><div className="text-xs"><strong>{f.properties?.name || "Punct"}</strong></div></Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
