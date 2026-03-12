"use client";

import { useMemo, useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, Polyline, GeoJSON, Marker, Tooltip, useMap } from "react-leaflet";
import type { Report, Proposal, Project, MapLayer, TransitStop, TransitShapeCollection, BikeRouteResult, SafeSpot } from "@/types";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

type LatLng = { lat: number; lng: number };
type NetworkType = "principala" | "secundara";
interface NetworkPolyline { coords: LatLng[]; type: NetworkType }

interface MapViewProps {
  reports: Report[];
  proposals?: Proposal[];
  projects?: Project[];
  transitStops?: TransitStop[];
  transitShapes?: TransitShapeCollection;
  infrastructureElements?: any[];
  layers: MapLayer[];
  onReportClick: (id: string) => void;
  bikeRoute?: BikeRouteResult | null;
  routePickerMode?: "start" | "end" | null;
  onMapClick?: (lat: number, lng: number) => void;
  routeStart?: { lat: number; lng: number } | null;
  routeEnd?: { lat: number; lng: number } | null;
  veloNetworkPolylines?: NetworkPolyline[];
  veloBikeRoute?: LatLng[];
  veloAccessRoute?: LatLng[];
  veloEgressRoute?: LatLng[];
}

const severityColors: Record<string, string> = {
  scazut: "#3b82f6",
  mediu: "#eab308",
  ridicat: "#f97316",
  critic: "#ef4444",
};

// Small icon factory for transit stops
function transitIcon() {
  return L.divIcon({
    className: "",
    html: `<div style="width:10px;height:10px;border-radius:50%;background:#f472b6;border:2px solid #fff;box-shadow:0 0 4px rgba(0,0,0,.5)"></div>`,
    iconSize: [10, 10],
    iconAnchor: [5, 5],
  });
}

function startIcon() {
  return L.divIcon({
    className: "",
    html: `<div style="width:20px;height:20px;border-radius:50%;background:#22c55e;border:3px solid #fff;box-shadow:0 0 8px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:bold">A</div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

function endIcon() {
  return L.divIcon({
    className: "",
    html: `<div style="width:20px;height:20px;border-radius:50%;background:#ef4444;border:3px solid #fff;box-shadow:0 0 8px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:bold">B</div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

function safeSpotIcon() {
  return L.divIcon({
    className: "",
    html: `<div style="width:14px;height:14px;border-radius:50%;background:#fbbf24;border:2px solid #fff;box-shadow:0 0 6px rgba(0,0,0,.4)"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

// Map click handler component
function MapClickHandler({ onClick }: { onClick?: (lat: number, lng: number) => void }) {
  const map = useMap();
  useEffect(() => {
    if (!onClick) return;
    const handler = (e: L.LeafletMouseEvent) => onClick(e.latlng.lat, e.latlng.lng);
    map.on("click", handler);
    return () => { map.off("click", handler); };
  }, [map, onClick]);
  return null;
}

// Route segment color based on road type — BOLD & VIVID
function routeSegmentColor(roadType: string): string {
  switch (roadType) {
    case "bike_lane": return "#10b981";    // bright emerald – safe
    case "pedestrian": return "#4ade80";   // vivid green
    case "shared": return "#f59e0b";       // strong amber – moderate
    case "car_only": return "#f43f5e";     // vivid rose – dangerous
    default: return "#cbd5e1";
  }
}

// Infrastructure element type → color
const infraColors: Record<string, string> = {
  bike_lane: "#a3e635",
  bike_parking: "#22d3ee",
  bike_signal: "#f59e0b",
  shared_lane: "#818cf8",
};

export default function MapView({
  reports,
  proposals = [],
  projects = [],
  transitStops = [],
  transitShapes,
  infrastructureElements = [],
  layers,
  onReportClick,
  bikeRoute,
  routePickerMode,
  onMapClick,
  routeStart,
  routeEnd,
  veloNetworkPolylines = [],
  veloBikeRoute = [],
  veloAccessRoute = [],
  veloEgressRoute = [],
}: MapViewProps) {
  const isVisible = (id: string) => layers.find((l) => l.id === id)?.visible ?? false;

  // Group infrastructure elements by type for rendering
  const infraPolylines = useMemo(() => {
    return infrastructureElements.filter((e) => e.geometry?.type === "LineString");
  }, [infrastructureElements]);

  const infraPoints = useMemo(() => {
    return infrastructureElements.filter((e) => e.geometry?.type === "Point");
  }, [infrastructureElements]);

  return (
    <MapContainer
      center={[44.4505, 26.1200]}
      zoom={14}
      style={{ height: "100%", width: "100%" }}
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Layer: Heatmap pericole - reports */}
      {isVisible("heatmap_pericole") &&
        reports.map((report) => (
          <CircleMarker
            key={report.id}
            center={[report.location.lat, report.location.lng]}
            radius={
              report.severity === "critic" ? 12 :
              report.severity === "ridicat" ? 10 :
              report.severity === "mediu" ? 8 : 6
            }
            pathOptions={{
              fillColor: severityColors[report.severity],
              color: severityColors[report.severity],
              weight: 2,
              opacity: 0.8,
              fillOpacity: 0.4,
            }}
            eventHandlers={{ click: () => onReportClick(report.id) }}
          >
            <Popup autoClose closeOnClick>
              <div className="text-xs">
                <p className="font-bold">{report.title}</p>
                <p>{report.categoryLabel}</p>
              </div>
            </Popup>
          </CircleMarker>
        ))}

      {/* Layer: Infrastructură - polylines (bike lanes) — BOLD */}
      {isVisible("infrastructura") &&
        infraPolylines.map((el) => {
          const coords: [number, number][] = el.geometry.coordinates.map(
            ([lng, lat]: [number, number]) => [lat, lng]
          );
          return (
            <Polyline
              key={el.id}
              positions={coords}
              pathOptions={{
                color: infraColors[el.type] || "#a3e635",
                weight: 6,
                opacity: 0.95,
              }}
            >
              <Tooltip sticky>{el.name || el.type}</Tooltip>
            </Polyline>
          );
        })}

      {/* Layer: Infrastructură - points (bike parking, signals) */}
      {isVisible("infrastructura") &&
        infraPoints.map((el) => {
          const [lng, lat] = el.geometry.coordinates;
          return (
            <CircleMarker
              key={el.id}
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

      {/* Layer: Proiecte */}
      {isVisible("proiecte") &&
        projects.map((proj) => {
          if (proj.geometry?.type === "LineString") {
            const coords: [number, number][] = proj.geometry.coordinates.map(
              ([lng, lat]: [number, number]) => [lat, lng]
            );
            return (
              <Polyline
                key={proj.id}
                positions={coords}
                pathOptions={{ color: "#00d4ff", weight: 7, opacity: 0.9, dashArray: "10 5" }}
              >
                <Tooltip sticky>{proj.title}</Tooltip>
              </Polyline>
            );
          }
          // Fallback: show as point
          return (
            <CircleMarker
              key={proj.id}
              center={[proj.location.lat, proj.location.lng]}
              radius={8}
              pathOptions={{ fillColor: "#00d4ff", color: "#00d4ff", weight: 3, fillOpacity: 0.5 }}
            >
              <Tooltip>{proj.title}</Tooltip>
            </CircleMarker>
          );
        })}

      {/* Layer: Propuneri */}
      {isVisible("propuneri") &&
        proposals.map((prop) => {
          if (prop.geometry?.type === "LineString") {
            const coords: [number, number][] = prop.geometry.coordinates.map(
              ([lng, lat]: [number, number]) => [lat, lng]
            );
            return (
              <Polyline
                key={prop.id}
                positions={coords}
                pathOptions={{ color: "#a855f7", weight: 6, opacity: 0.9, dashArray: "8 4" }}
              >
                <Tooltip sticky>{prop.title} ({prop.votes} voturi)</Tooltip>
              </Polyline>
            );
          }
          return (
            <CircleMarker
              key={prop.id}
              center={[prop.location.lat, prop.location.lng]}
              radius={7}
              pathOptions={{ fillColor: "#a855f7", color: "#a855f7", weight: 3, fillOpacity: 0.5 }}
            >
              <Tooltip>{prop.title} ({prop.votes} voturi)</Tooltip>
            </CircleMarker>
          );
        })}

      {/* Layer: Transport public - transit shapes */}
      {isVisible("transport_public") && transitShapes && (
        <GeoJSON
          data={transitShapes as any}
          style={() => ({
            color: "#f472b6",
            weight: 3,
            opacity: 0.6,
          })}
        />
      )}

      {/* Layer: Transport public - transit stops */}
      {isVisible("transport_public") &&
        transitStops.map((stop) => (
          <Marker
            key={stop.id}
            position={[stop.latitude, stop.longitude]}
            icon={transitIcon()}
          >
            <Tooltip>{stop.name}</Tooltip>
          </Marker>
        ))}

      {/* Route planner: click handler */}
      {routePickerMode && <MapClickHandler onClick={onMapClick} />}

      {/* Route planner: start/end markers */}
      {routeStart && (
        <Marker position={[routeStart.lat, routeStart.lng]} icon={startIcon()}>
          <Tooltip permanent direction="top" offset={[0, -12]}>Start</Tooltip>
        </Marker>
      )}
      {routeEnd && (
        <Marker position={[routeEnd.lat, routeEnd.lng]} icon={endIcon()}>
          <Tooltip permanent direction="top" offset={[0, -12]}>Destinație</Tooltip>
        </Marker>
      )}

      {/* Route planner: route segments color-coded by safety — EXTRA BOLD */}
      {bikeRoute?.found && bikeRoute.segments.map((seg, idx) => {
        if (!seg.coordinates || seg.coordinates.length < 2) return null;
        const positions: [number, number][] = seg.coordinates.map(
          ([lng, lat]) => [lat, lng] as [number, number]
        );
        return (
          <Polyline
            key={`route-seg-${idx}`}
            positions={positions}
            pathOptions={{
              color: routeSegmentColor(seg.roadType),
              weight: 8,
              opacity: 1,
            }}
          >
            <Tooltip sticky>
              {seg.name} — {seg.roadType === "bike_lane" ? "Pistă ciclabilă" :
                seg.roadType === "shared" ? "Bandă partajată" :
                seg.roadType === "pedestrian" ? "Zonă pietonală" :
                "Drum auto"} (siguranță: {seg.safetyScore}%)
            </Tooltip>
          </Polyline>
        );
      })}

      {/* Route planner: safe spot markers */}
      {bikeRoute?.found && bikeRoute.safeSpots.map((spot, idx) => (
        <Marker
          key={`safe-${idx}`}
          position={[spot.lat, spot.lng]}
          icon={safeSpotIcon()}
        >
          <Tooltip>{spot.name}</Tooltip>
        </Marker>
      ))}

      {/* ═══ Velo network overlay (GeoJSON primary/secondary bike lanes) ═══ */}
      {veloNetworkPolylines.map((line, idx) => (
        <Polyline
          key={`velo-net-${idx}`}
          positions={line.coords.map((c) => [c.lat, c.lng] as [number, number])}
          pathOptions={{
            color: line.type === "principala" ? "#22d3ee" : "#818cf8",
            weight: line.type === "principala" ? 5 : 4,
            opacity: 0.6,
          }}
        />
      ))}

      {/* ═══ Velo client-side route: access (dashed white) ═══ */}
      {veloAccessRoute.length > 1 && (
        <Polyline
          positions={veloAccessRoute.map((c) => [c.lat, c.lng] as [number, number])}
          pathOptions={{
            color: "#e2e8f0",
            weight: 6,
            opacity: 0.9,
            dashArray: "8 6",
          }}
        />
      )}

      {/* ═══ Velo client-side route: bike segment (bright yellow-green BOLD) ═══ */}
      {veloBikeRoute.length > 1 && (
        <Polyline
          positions={veloBikeRoute.map((c) => [c.lat, c.lng] as [number, number])}
          pathOptions={{
            color: "#facc15",
            weight: 8,
            opacity: 1,
          }}
        />
      )}

      {/* ═══ Velo client-side route: egress (dashed white) ═══ */}
      {veloEgressRoute.length > 1 && (
        <Polyline
          positions={veloEgressRoute.map((c) => [c.lat, c.lng] as [number, number])}
          pathOptions={{
            color: "#e2e8f0",
            weight: 6,
            opacity: 0.9,
            dashArray: "8 6",
          }}
        />
      )}
    </MapContainer>
  );
}
