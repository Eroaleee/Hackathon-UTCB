"use client";

import { useMemo, useEffect, useRef } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, Polyline, GeoJSON, Marker, Tooltip, useMap, Circle } from "react-leaflet";
import type { Report, Proposal, Project, MapLayer, TransitStop, TransitShapeCollection } from "@/types";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

type LatLng = { lat: number; lng: number };

type NetworkType = "principala" | "secundara";

interface NetworkPolyline {
  coords: LatLng[];
  type: NetworkType;
}

interface LocalRouteResult {
  found: boolean;
  totalDistanceKm: number;
  totalTimeMin: number;
  bikeKm: number;
  bikePercent: number;
  accessRoute: LatLng[];
  bikeRoute: LatLng[];
  egressRoute: LatLng[];
}

interface MapViewProps {
  reports: Report[];
  proposals?: Proposal[];
  projects?: Project[];
  transitStops?: TransitStop[];
  transitShapes?: TransitShapeCollection;
  infrastructureElements?: any[];
  layers: MapLayer[];
  onReportClick: (id: string) => void;
  localRoute?: LocalRouteResult | null;
  networkPolylines?: NetworkPolyline[];
  routePickerMode?: "start" | "end" | null;
  onMapClick?: (lat: number, lng: number) => void;
  routeStart?: { lat: number; lng: number } | null;
  routeEnd?: { lat: number; lng: number } | null;
  navigationMode?: boolean;
  userPosition?: LatLng | null;
}

const severityColors: Record<string, string> = {
  scazut: "#3b82f6",
  mediu: "#eab308",
  ridicat: "#f97316",
  critic: "#ef4444",
};

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

function NavigationFollower({ position, active }: { position: LatLng | null; active: boolean }) {
  const map = useMap();
  const firstFollow = useRef(true);

  useEffect(() => {
    if (!active || !position) return;
    if (firstFollow.current) {
      map.setView([position.lat, position.lng], 17, { animate: true });
      firstFollow.current = false;
    } else {
      map.panTo([position.lat, position.lng], { animate: true, duration: 0.5 });
    }
  }, [map, position, active]);

  useEffect(() => {
    if (!active) firstFollow.current = true;
  }, [active]);

  return null;
}

function FitLocalRouteBounds({ route }: { route: LocalRouteResult | null | undefined }) {
  const map = useMap();
  const fitted = useRef<string | null>(null);

  useEffect(() => {
    if (!route?.found) return;
    
    const allCoords: [number, number][] = [];
    for (const pt of route.accessRoute) {
      allCoords.push([pt.lat, pt.lng]);
    }
    for (const pt of route.bikeRoute) {
      allCoords.push([pt.lat, pt.lng]);
    }
    for (const pt of route.egressRoute) {
      allCoords.push([pt.lat, pt.lng]);
    }

    if (allCoords.length === 0) return;

    const key = allCoords.map(c => `${c[0].toFixed(4)},${c[1].toFixed(4)}`).join("|").slice(0, 100);
    if (fitted.current === key) return;
    fitted.current = key;

    const bounds = L.latLngBounds(allCoords);
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
  }, [map, route]);

  return null;
}

function haversineM(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function userPositionIcon() {
  return L.divIcon({
    className: "",
    html: `<div style="position:relative;width:24px;height:24px">
      <div style="position:absolute;inset:0;border-radius:50%;background:rgba(59,130,246,0.2);animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite"></div>
      <div style="position:absolute;top:4px;left:4px;width:16px;height:16px;border-radius:50%;background:#3b82f6;border:3px solid #fff;box-shadow:0 0 8px rgba(0,0,0,.5)"></div>
    </div>
    <style>@keyframes ping{75%,100%{transform:scale(2);opacity:0}}</style>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

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
  localRoute,
  networkPolylines = [],
  routePickerMode,
  onMapClick,
  routeStart,
  routeEnd,
  navigationMode = false,
  userPosition = null,
}: MapViewProps) {
  const isVisible = (id: string) => layers.find((l) => l.id === id)?.visible ?? false;

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

      {/* Network polylines: bike lanes from GeoJSON */}
      {isVisible("infrastructura") && networkPolylines.map((line, idx) => (
        <Polyline
          key={`network-${idx}`}
          positions={line.coords.map((c) => [c.lat, c.lng]) as [number, number][]}
          pathOptions={{
            color: line.type === "principala" ? "#22c55e" : "#3b82f6",
            weight: line.type === "principala" ? 5 : 4,
            opacity: 0.8,
          }}
        >
          <Tooltip sticky>
            {line.type === "principala" ? "Pistă principală" : "Pistă secundară"}
          </Tooltip>
        </Polyline>
      ))}

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

      {/* Layer: Infrastructură - polylines (from DB) */}
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

      {/* Local route: access route (street, dashed gray) */}
      {localRoute?.found && localRoute.accessRoute.length > 1 && (
        <Polyline
          positions={localRoute.accessRoute.map((pt) => [pt.lat, pt.lng]) as [number, number][]}
          pathOptions={{
            color: "#9ca3af",
            weight: 5,
            opacity: 0.9,
            dashArray: "8 6",
          }}
        >
          <Tooltip sticky>Acces pe stradă</Tooltip>
        </Polyline>
      )}

      {/* Local route: bike route (yellow, solid) */}
      {localRoute?.found && localRoute.bikeRoute.length > 1 && (
        <Polyline
          positions={localRoute.bikeRoute.map((pt) => [pt.lat, pt.lng]) as [number, number][]}
          pathOptions={{
            color: "#eab308",
            weight: 7,
            opacity: 1,
          }}
        >
          <Tooltip sticky>Pe pistă ciclabilă</Tooltip>
        </Polyline>
      )}

      {/* Local route: egress route (street, dashed gray) */}
      {localRoute?.found && localRoute.egressRoute.length > 1 && (
        <Polyline
          positions={localRoute.egressRoute.map((pt) => [pt.lat, pt.lng]) as [number, number][]}
          pathOptions={{
            color: "#9ca3af",
            weight: 5,
            opacity: 0.9,
            dashArray: "8 6",
          }}
        >
          <Tooltip sticky>Ieșire pe stradă</Tooltip>
        </Polyline>
      )}

      {/* Navigation mode: follow user position */}
      <NavigationFollower position={userPosition} active={navigationMode} />

      {/* Fit bounds to local route when not in navigation */}
      {!navigationMode && <FitLocalRouteBounds route={localRoute} />}

      {/* User GPS position marker */}
      {userPosition && (
        <Marker position={[userPosition.lat, userPosition.lng]} icon={userPositionIcon()}>
          <Tooltip>Poziția ta</Tooltip>
        </Marker>
      )}

      {/* Navigation mode: proximity heatmap (reports within 500m) */}
      {navigationMode && userPosition && reports.map((report) => {
        const dist = haversineM(userPosition, report.location);
        if (dist > 500) return null;
        const opacity = Math.max(0.2, 1 - dist / 500);
        return (
          <Circle
            key={`nav-heat-${report.id}`}
            center={[report.location.lat, report.location.lng]}
            radius={Math.max(30, 80 - dist * 0.1)}
            pathOptions={{
              fillColor: severityColors[report.severity],
              color: severityColors[report.severity],
              weight: 1,
              fillOpacity: opacity * 0.5,
              opacity: opacity,
            }}
          >
            <Popup>
              <div className="text-xs">
                <p className="font-bold">{report.title}</p>
                <p>{report.categoryLabel}</p>
              </div>
            </Popup>
          </Circle>
        );
      })}
    </MapContainer>
  );
}
