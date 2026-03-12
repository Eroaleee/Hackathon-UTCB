"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import {
  Layers,
  X,
  Clock,
  AlertTriangle,
  Megaphone,
  ChevronRight,
  Filter,
  MapPin,
  Navigation,
  Navigation2,
  Bike,
  Shield,
  Gauge,
  Loader2,
  Crosshair,
  LocateFixed,
  Plus,
  Car,
  CircleDot,
  Construction,
  Ban,
  PersonStanding,
  ParkingCircle,
  Lightbulb,
  CheckCircle,
  type LucideIcon,
} from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { PageTransition } from "@/components/ui/page-transition";
import {
  defaultMapLayers,
  reportStatusConfig,
  severityConfig,
} from "@/lib/mock-data";
import {
  useReports,
  useProposals,
  useProjects,
  useTransitStops,
  useTransitShapes,
  useInfrastructureElements,
  planBikeRoute,
  apiPost,
} from "@/lib/api";
import type { MapLayer, Report, BikeRouteResult, ReportCategory } from "@/types";
import { cn } from "@/lib/utils";

/* ───────── types for client-side velo routing ───────── */
type LatLng = { lat: number; lng: number };

interface BikeGeoJsonFeature {
  type: "Feature";
  geometry: { type: "LineString" | "MultiLineString"; coordinates: number[][] | number[][][] };
  properties: { Lungime?: number; [k: string]: unknown };
}
interface BikeGeoJsonCollection { type: "FeatureCollection"; features: BikeGeoJsonFeature[] }

type NetworkType = "principala" | "secundara";
interface NetworkPolyline { coords: LatLng[]; type: NetworkType }

interface StreetGeoJsonFeature {
  type: "Feature";
  geometry: { type: "LineString" | "MultiLineString"; coordinates: number[][] | number[][][] };
  properties: { lungime?: number; tipstrada?: string; strada?: string; [k: string]: unknown };
}
interface StreetGeoJsonCollection { type: "FeatureCollection"; features: StreetGeoJsonFeature[] }

interface Graph { nodes: LatLng[]; edges: Map<number, { to: number; weight: number }[]> }

/* ───── haversine ───── */
function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/* ───── build bike network graph ───── */
function buildNetworkAndGraph(p: BikeGeoJsonCollection | null, s: BikeGeoJsonCollection | null): { polylines: NetworkPolyline[]; graph: Graph | null } {
  if (!p && !s) return { polylines: [], graph: null };
  const polylines: NetworkPolyline[] = [];
  const nodes: LatLng[] = [];
  const edges = new Map<number, { to: number; weight: number }[]>();
  const idx = new Map<string, number>();
  const addN = (c: LatLng) => { const k = `${c.lat.toFixed(4)},${c.lng.toFixed(4)}`; if (idx.has(k)) return idx.get(k)!; const i = nodes.length; nodes.push(c); idx.set(k, i); return i; };
  const addE = (a: number, b: number, w: number) => { if (!edges.has(a)) edges.set(a, []); if (!edges.has(b)) edges.set(b, []); edges.get(a)!.push({ to: b, weight: w }); edges.get(b)!.push({ to: a, weight: w }); };
  const proc = (col: BikeGeoJsonCollection | null, type: NetworkType) => {
    if (!col) return;
    for (const f of col.features) {
      if (!f.geometry) continue;
      const hl = (coords: number[][]) => { if (coords.length < 2) return; const ll = coords.map(([lng, lat]) => ({ lat, lng })); polylines.push({ coords: ll, type }); for (let i = 0; i < ll.length - 1; i++) { const a = addN(ll[i]), b = addN(ll[i + 1]); addE(a, b, haversineKm(ll[i], ll[i + 1]) * (type === "principala" ? 0.9 : 1)); } };
      if (f.geometry.type === "LineString") hl(f.geometry.coordinates as number[][]);
      else if (f.geometry.type === "MultiLineString") for (const part of f.geometry.coordinates as number[][][]) hl(part);
    }
  };
  proc(p, "principala"); proc(s, "secundara");
  if (!nodes.length) return { polylines, graph: null };
  return { polylines, graph: { nodes, edges } };
}

/* ───── build street graph ───── */
function buildStreetGraph(strazi: StreetGeoJsonCollection | null): Graph | null {
  if (!strazi) return null;
  const nodes: LatLng[] = [];
  const edges = new Map<number, { to: number; weight: number }[]>();
  const eSet = new Set<string>();
  const idx = new Map<string, number>();
  const addN = (c: LatLng) => { const k = `${c.lat.toFixed(4)},${c.lng.toFixed(4)}`; if (idx.has(k)) return idx.get(k)!; const i = nodes.length; nodes.push(c); idx.set(k, i); return i; };
  const addE = (a: number, b: number, w: number) => { if (a === b) return; const k = `${a}-${b}`; if (eSet.has(k) || eSet.has(`${b}-${a}`)) return; eSet.add(k); if (!edges.has(a)) edges.set(a, []); if (!edges.has(b)) edges.set(b, []); edges.get(a)!.push({ to: b, weight: w }); edges.get(b)!.push({ to: a, weight: w }); };

  for (const f of strazi.features) {
    if (!f.geometry) continue;
    let rings: number[][][] = [];
    if (f.geometry.type === "LineString") rings = [f.geometry.coordinates as number[][]];
    else if (f.geometry.type === "MultiLineString") rings = f.geometry.coordinates as number[][][];
    for (const coords of rings) { if (!coords || coords.length < 2) continue; const ll = coords.map(([lng, lat]) => ({ lat, lng })); for (let i = 0; i < ll.length - 1; i++) addE(addN(ll[i]), addN(ll[i + 1]), haversineKm(ll[i], ll[i + 1])); }
  }

  // bridge small gaps
  const cs = 0.002;
  const grid = new Map<string, number[]>();
  const ck = (lat: number, lng: number) => `${Math.floor(lat / cs)}_${Math.floor(lng / cs)}`;
  nodes.forEach((n, i) => { const k = ck(n.lat, n.lng); if (!grid.has(k)) grid.set(k, []); grid.get(k)!.push(i); });
  nodes.forEach((n, i) => { const [cy, cx] = ck(n.lat, n.lng).split("_").map(Number); for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const b = grid.get(`${cy + dy}_${cx + dx}`); if (!b) continue; for (const j of b) { if (j <= i) continue; const d = haversineKm(n, nodes[j]); if (d <= 0.05) addE(i, j, d); } } });
  if (!nodes.length) return null;
  return { nodes, edges };
}

/* ───── dijkstra ───── */
function dijkstra(g: Graph, s: number, t: number): { path: number[]; distanceKm: number } | null {
  const dist = new Array(g.nodes.length).fill(Infinity);
  const prev = new Array<number | null>(g.nodes.length).fill(null);
  const vis = new Array(g.nodes.length).fill(false);
  dist[s] = 0;
  for (let i = 0; i < g.nodes.length; i++) {
    let u: number | null = null, best = Infinity;
    for (let j = 0; j < g.nodes.length; j++) if (!vis[j] && dist[j] < best) { best = dist[j]; u = j; }
    if (u === null || u === t) break;
    vis[u] = true;
    for (const { to, weight } of g.edges.get(u) || []) { const alt = dist[u] + weight; if (alt < dist[to]) { dist[to] = alt; prev[to] = u; } }
  }
  if (!isFinite(dist[t])) return null;
  const path: number[] = []; let u: number | null = t; while (u !== null) { path.unshift(u); u = prev[u]; }
  return { path, distanceKm: dist[t] };
}

function findNearest(g: Graph, p: LatLng) { let bi: number | null = null, bd = Infinity; for (let i = 0; i < g.nodes.length; i++) { const d = haversineKm(p, g.nodes[i]); if (d < bd) { bd = d; bi = i; } } return bi == null ? null : { idx: bi, distKm: bd }; }
function pathDist(c: LatLng[]) { let t = 0; for (let i = 0; i < c.length - 1; i++) t += haversineKm(c[i], c[i + 1]); return t; }

function routeOnStreet(g: Graph, sp: LatLng, ep: LatLng): { coords: LatLng[]; distKm: number } | null {
  const sn = findNearest(g, sp), en = findNearest(g, ep);
  if (!sn || !en) return null;
  const res = dijkstra(g, sn.idx, en.idx);
  if (res) { const c = [sp, ...res.path.map(i => g.nodes[i]), ep]; return { coords: c, distKm: pathDist(c) }; }
  // fallback
  const wps: LatLng[] = [sp];
  for (let i = 1; i < 20; i++) { const t = i / 20; const s = { lat: sp.lat + (ep.lat - sp.lat) * t, lng: sp.lng + (ep.lng - sp.lng) * t }; const n = findNearest(g, s); if (n && n.distKm < 0.1 && haversineKm(wps[wps.length - 1], g.nodes[n.idx]) > 0.02) wps.push(g.nodes[n.idx]); }
  wps.push(ep);
  return { coords: wps, distKm: pathDist(wps) };
}

/* ───── dynamic map import ───── */
const MapView = dynamic<{
  reports: Report[];
  proposals?: any[];
  projects?: any[];
  transitStops?: any[];
  transitShapes?: any;
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
}>(() => import("@/app/cetatean/harta/map-view").then((mod) => mod.default), {
  ssr: false,
});

const timeRanges = [
  { value: "week", label: "Ultimele 7 zile" },
  { value: "month", label: "Ultima lună" },
  { value: "year", label: "Ultimul an" },
  { value: "all", label: "Tot" },
];

export default function HartaPage() {
  const [layers, setLayers] = useState<MapLayer[]>(defaultMapLayers);
  const [timeRange, setTimeRange] = useState("all");
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [showLayerPanel, setShowLayerPanel] = useState(true);
  const { data: reports } = useReports();
  const { data: proposals } = useProposals();
  const { data: projects } = useProjects();
  const { data: transitStops } = useTransitStops();
  const { data: transitShapes } = useTransitShapes();
  const { data: infraElements } = useInfrastructureElements();

  /* ─── Route planner state (backend-powered) ─── */
  const [showRoutePlanner, setShowRoutePlanner] = useState(false);
  const [routePickerMode, setRoutePickerMode] = useState<"start" | "end" | null>(null);
  const [routeStart, setRouteStart] = useState<{ lat: number; lng: number } | null>(null);
  const [routeEnd, setRouteEnd] = useState<{ lat: number; lng: number } | null>(null);
  const [bikeRoute, setBikeRoute] = useState<BikeRouteResult | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);

  /* ─── Address geocoding ─── */
  const [startAddress, setStartAddress] = useState("");
  const [endAddress, setEndAddress] = useState("");
  const [geocodeError, setGeocodeError] = useState<string | null>(null);

  /* ─── Client-side velo GeoJSON routing ─── */
  const [principale, setPrincipale] = useState<BikeGeoJsonCollection | null>(null);
  const [secundare, setSecundare] = useState<BikeGeoJsonCollection | null>(null);
  const [strazi, setStrazi] = useState<StreetGeoJsonCollection | null>(null);
  const [loadingVeloNetwork, setLoadingVeloNetwork] = useState(false);
  const [veloBikeRoute, setVeloBikeRoute] = useState<LatLng[]>([]);
  const [veloAccessRoute, setVeloAccessRoute] = useState<LatLng[]>([]);
  const [veloEgressRoute, setVeloEgressRoute] = useState<LatLng[]>([]);
  const [veloDistKm, setVeloDistKm] = useState<number | null>(null);
  const [isVeloRouting, setIsVeloRouting] = useState(false);

  /* ─── FAB & Quick Report state ─── */
  const [fabOpen, setFabOpen] = useState(false);
  const [showQuickReport, setShowQuickReport] = useState(false);
  const [reportSubmitting, setReportSubmitting] = useState<ReportCategory | null>(null);
  const [reportSuccess, setReportSuccess] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [gpsPosition, setGpsPosition] = useState<{ lat: number; lng: number } | null>(null);

  /* ─── Acquire GPS once on page load ─── */
  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => setGpsPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, timeout: 10000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const quickReportCategories: { id: ReportCategory; label: string; icon: LucideIcon; color: string }[] = [
    { id: "masini_parcate", label: "Mașini parcate", icon: Car, color: "text-red-400" },
    { id: "gropi", label: "Gropi", icon: CircleDot, color: "text-orange-400" },
    { id: "constructii", label: "Construcții", icon: Construction, color: "text-yellow-400" },
    { id: "drum_blocat", label: "Drum blocat", icon: Ban, color: "text-red-500" },
    { id: "interferenta_pietoni", label: "Pietoni", icon: PersonStanding, color: "text-blue-400" },
    { id: "obstacole", label: "Obstacole", icon: AlertTriangle, color: "text-amber-400" },
    { id: "parcari_biciclete", label: "Parcări", icon: ParkingCircle, color: "text-cyan-400" },
    { id: "iluminat", label: "Iluminat", icon: Lightbulb, color: "text-yellow-300" },
    { id: "altele", label: "Altele", icon: MapPin, color: "text-gray-400" },
  ];

  const openQuickReport = useCallback(() => {
    setFabOpen(false);
    setShowQuickReport(true);
    setReportSuccess(false);
    setReportError(null);
    if (!gpsPosition && !navigator.geolocation) {
      setReportError("GPS indisponibil pe acest dispozitiv.");
    }
  }, [gpsPosition]);

  const submitQuickReport = async (category: ReportCategory) => {
    if (!gpsPosition) {
      setReportError("Se așteaptă localizarea GPS...");
      return;
    }
    setReportSubmitting(category);
    setReportError(null);
    try {
      const catLabel = quickReportCategories.find(c => c.id === category)?.label || category;
      await apiPost("/reports", {
        category,
        categoryLabel: catLabel,
        severity: "mediu",
        title: `${catLabel} — raport rapid`,
        description: "Raport rapid de pe hartă",
        latitude: gpsPosition.lat,
        longitude: gpsPosition.lng,
        address: `${gpsPosition.lat.toFixed(5)}, ${gpsPosition.lng.toFixed(5)}`,
        seenCount: 1,
      });
      setReportSuccess(true);
      setTimeout(() => {
        setShowQuickReport(false);
        setReportSuccess(false);
      }, 1500);
    } catch {
      setReportError("Eroare la trimitere. Încearcă din nou.");
    } finally {
      setReportSubmitting(null);
    }
  };

  // Load GeoJSON data when route planner opens
  useEffect(() => {
    if (!showRoutePlanner || principale) return;
    const load = async () => {
      try {
        setLoadingVeloNetwork(true);
        const [pR, sR, stR] = await Promise.all([
          fetch("/data/principale.geojson"),
          fetch("/data/secundare.geojson"),
          fetch("/data/strazi_centerline.geojson"),
        ]);
        if (pR.ok) setPrincipale(await pR.json());
        if (sR.ok) setSecundare(await sR.json());
        if (stR.ok) setStrazi(await stR.json());
      } catch (err) {
        console.error("Failed to load velo GeoJSON:", err);
      } finally {
        setLoadingVeloNetwork(false);
      }
    };
    load();
  }, [showRoutePlanner, principale]);

  const { polylines: veloNetworkPolylines, graph: veloGraph } = useMemo(
    () => buildNetworkAndGraph(principale, secundare),
    [principale, secundare]
  );
  const streetGraph = useMemo(() => buildStreetGraph(strazi), [strazi]);

  const allReports = reports ?? [];
  const selectedReport = allReports.find((r) => r.id === selectedReportId);

  const toggleLayer = (id: string) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l))
    );
  };

  /* ─── Map click handler ─── */
  const handleMapClick = (lat: number, lng: number) => {
    if (routePickerMode === "start") {
      setRouteStart({ lat, lng });
      setStartAddress("");
      setRoutePickerMode(null);
      setBikeRoute(null);
      clearVeloRoute();
    } else if (routePickerMode === "end") {
      setRouteEnd({ lat, lng });
      setEndAddress("");
      setRoutePickerMode(null);
    }
  };

  /* ─── Geocode address ─── */
  const geocodeAddress = async (addr: string): Promise<LatLng | null> => {
    if (!addr.trim()) return null;
    setGeocodeError(null);
    try {
      const q = encodeURIComponent(`${addr}, București, România`);
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`);
      if (!res.ok) throw new Error("Geocodare eșuată");
      const data = await res.json();
      if (!data?.length) { setGeocodeError("Adresa nu a fost găsită."); return null; }
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    } catch { setGeocodeError("Eroare la geocodare."); return null; }
  };

  const handleGeocodeStart = async () => {
    const pt = await geocodeAddress(startAddress);
    if (pt) { setRouteStart(pt); setBikeRoute(null); clearVeloRoute(); }
  };
  const handleGeocodeEnd = async () => {
    const pt = await geocodeAddress(endAddress);
    if (pt) setRouteEnd(pt);
  };

  /* ─── GPS location for route planner ─── */
  const handleUseGPS = (target: "start" | "end") => {
    if (gpsPosition) {
      if (target === "start") { setRouteStart(gpsPosition); setStartAddress(""); setBikeRoute(null); clearVeloRoute(); }
      else { setRouteEnd(gpsPosition); setEndAddress(""); }
      return;
    }
    if (!navigator.geolocation) { setGeocodeError("GPS indisponibil"); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const pt = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setGpsPosition(pt);
        if (target === "start") { setRouteStart(pt); setStartAddress(""); setBikeRoute(null); clearVeloRoute(); }
        else { setRouteEnd(pt); setEndAddress(""); }
      },
      () => setGeocodeError("Nu pot accesa GPS.")
    );
  };

  /* ─── Compute routes (backend + client) ─── */
  const clearVeloRoute = () => { setVeloBikeRoute([]); setVeloAccessRoute([]); setVeloEgressRoute([]); setVeloDistKm(null); };

  const calculateRoute = async () => {
    if (!routeStart || !routeEnd) return;
    setRouteLoading(true);
    setRouteError(null);

    // Backend route
    try {
      const result = await planBikeRoute(routeStart.lat, routeStart.lng, routeEnd.lat, routeEnd.lng);
      setBikeRoute(result);
      if (!result.found) setRouteError("Nu s-a găsit o rută backend.");
    } catch (err: any) {
      console.error("Backend route error:", err);
      setRouteError(`Eroare backend: ${err?.message || "Necunoscută"}`);
    } finally {
      setRouteLoading(false);
    }

    // Client-side velo route
    computeVeloRoute(routeStart, routeEnd);
  };

  const computeVeloRoute = (start: LatLng, end: LatLng) => {
    if (!streetGraph && !veloGraph) return;
    setIsVeloRouting(true);
    try {
      clearVeloRoute();

      let stRoute: { coords: LatLng[]; distKm: number } | null = null;
      if (streetGraph) stRoute = routeOnStreet(streetGraph, start, end);

      type Mixed = { coordsAccess: LatLng[]; coordsBike: LatLng[]; coordsEgress: LatLng[]; totalKm: number; bikeKm: number };
      let mixed: Mixed | null = null;
      if (veloGraph && streetGraph) {
        const sB = findNearest(veloGraph, start), eB = findNearest(veloGraph, end);
        if (sB && eB && sB.distKm <= 0.3 && eB.distKm <= 0.3) {
          const bp = dijkstra(veloGraph, sB.idx, eB.idx);
          if (bp) {
            const bc = bp.path.map(i => veloGraph.nodes[i]);
            const acc = routeOnStreet(streetGraph, start, bc[0]);
            const egr = routeOnStreet(streetGraph, bc[bc.length - 1], end);
            if (acc && egr) {
              const bKm = pathDist(bc);
              mixed = { coordsAccess: acc.coords, coordsBike: bc, coordsEgress: egr.coords, totalKm: acc.distKm + bKm + egr.distKm, bikeKm: bKm };
            }
          }
        }
      }

      if (!stRoute && !mixed) return;
      if (stRoute && !mixed) { setVeloAccessRoute(stRoute.coords); setVeloDistKm(stRoute.distKm); return; }
      if (!stRoute && mixed) { setVeloAccessRoute(mixed.coordsAccess); setVeloBikeRoute(mixed.coordsBike); setVeloEgressRoute(mixed.coordsEgress); setVeloDistKm(mixed.totalKm); return; }

      const tol = Math.max(0.3, Math.min(stRoute!.distKm, mixed!.totalKm) * 0.1);
      if (mixed!.totalKm <= stRoute!.distKm + tol && mixed!.bikeKm > 0) {
        setVeloAccessRoute(mixed!.coordsAccess); setVeloBikeRoute(mixed!.coordsBike); setVeloEgressRoute(mixed!.coordsEgress); setVeloDistKm(mixed!.totalKm);
      } else {
        setVeloAccessRoute(stRoute!.coords); setVeloDistKm(stRoute!.distKm);
      }
    } finally {
      setIsVeloRouting(false);
    }
  };

  // Auto-compute when both points set
  useEffect(() => {
    if (routeStart && routeEnd && showRoutePlanner) calculateRoute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeStart, routeEnd]);

  const resetRoute = () => {
    setRouteStart(null); setRouteEnd(null); setBikeRoute(null);
    setRoutePickerMode(null); setRouteError(null); setGeocodeError(null);
    setStartAddress(""); setEndAddress("");
    clearVeloRoute();
  };

  return (
    <PageTransition className="h-[calc(100vh-3.5rem-2rem)] sm:h-[calc(100vh-3.5rem-3rem)] -m-4 lg:-m-6 relative">
      {/* Map */}
      <MapView
        reports={allReports}
        proposals={proposals}
        projects={projects}
        transitStops={transitStops}
        transitShapes={transitShapes}
        infrastructureElements={infraElements}
        layers={layers}
        onReportClick={setSelectedReportId}
        bikeRoute={bikeRoute}
        routePickerMode={routePickerMode}
        onMapClick={handleMapClick}
        routeStart={routeStart}
        routeEnd={routeEnd}
        veloNetworkPolylines={showRoutePlanner ? veloNetworkPolylines : undefined}
        veloBikeRoute={veloBikeRoute}
        veloAccessRoute={veloAccessRoute}
        veloEgressRoute={veloEgressRoute}
      />

      {/* Layer control panel */}
      <AnimatePresence>
        {showLayerPanel && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[999] bg-black/30 lg:hidden"
              onClick={() => setShowLayerPanel(false)}
            />
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.4}
              onDragEnd={(_, info) => {
                if (info.offset.x > 80) setShowLayerPanel(false);
              }}
              className="absolute top-4 right-4 z-[1000]"
          >
            <GlassCard className="w-56 sm:w-64 p-3">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold font-[family-name:var(--font-heading)]">
                    Straturi
                  </span>
                </div>
                <button
                  onClick={() => setShowLayerPanel(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-1">
                {layers.map((layer) => (
                  <button
                    key={layer.id}
                    onClick={() => toggleLayer(layer.id)}
                    className={cn(
                      "flex items-center gap-2 w-full rounded-lg px-2 py-1.5 text-xs transition-colors",
                      layer.visible
                        ? "bg-surface-light text-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-surface-light/50"
                    )}
                  >
                    <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: layer.color }} />
                    <span className="flex-1 text-left">{layer.label}</span>
                    <div
                      className={cn(
                        "h-2 w-2 rounded-full",
                        layer.visible ? "bg-accent" : "bg-muted-foreground/30"
                      )}
                    />
                  </button>
                ))}
              </div>
            </GlassCard>
          </motion.div>
          </>
        )}
      </AnimatePresence>

      {!showLayerPanel && (
        <button
          onClick={() => setShowLayerPanel(true)}
          className="absolute top-4 right-4 z-[1000] glass-strong rounded-lg p-2 hover:bg-surface-light transition-colors"
        >
          <Layers className="h-5 w-5 text-primary" />
        </button>
      )}

      {/* Time range slider */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] max-w-[calc(100vw-2rem)]">
        <GlassCard className="flex gap-1 p-1 overflow-x-auto">
          {timeRanges.map((t) => (
            <button
              key={t.value}
              onClick={() => setTimeRange(t.value)}
              className={cn(
                "relative px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                timeRange === t.value ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {timeRange === t.value && (
                <motion.div
                  layoutId="time-range-active"
                  className="absolute inset-0 rounded-md bg-primary/10 border border-primary/20"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative z-10 whitespace-nowrap">{t.label}</span>
            </button>
          ))}
        </GlassCard>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-[1000] hidden sm:block">
        <GlassCard className="p-2">
          <p className="text-[10px] font-medium text-muted-foreground mb-1">Legendă</p>
          <div className="space-y-0.5">
            {[
              { color: "bg-red-500", label: "Pericol ridicat" },
              { color: "bg-orange-500", label: "Pericol mediu" },
              { color: "bg-yellow-500", label: "Atenționare" },
              { color: "bg-green-500", label: "Rezolvat" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-1.5">
                <div className={cn("h-2 w-2 rounded-full", item.color)} />
                <span className="text-[10px] text-muted-foreground">{item.label}</span>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      {/* Report details drawer */}
      <AnimatePresence>
        {selectedReport && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[999] bg-black/30 lg:hidden"
              onClick={() => setSelectedReportId(null)}
            />
            <motion.div
              initial={{ opacity: 0, x: -300 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -300 }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.4}
              onDragEnd={(_, info) => {
                if (info.offset.x < -80) setSelectedReportId(null);
              }}
              className="absolute top-4 left-4 z-[1000] w-72 sm:w-80"
          >
            <GlassCard className="p-4">
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-sm font-semibold font-[family-name:var(--font-heading)] pr-4">
                  {selectedReport.title}
                </h3>
                <button
                  onClick={() => setSelectedReportId(null)}
                  className="text-muted-foreground hover:text-foreground shrink-0 p-1 -m-1 rounded-lg hover:bg-surface-light"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex gap-2 mb-3">
                <StatusBadge
                  label={reportStatusConfig[selectedReport.status].label}
                  colorClass={reportStatusConfig[selectedReport.status].color}
                />
                <StatusBadge
                  label={severityConfig[selectedReport.severity].label}
                  colorClass={severityConfig[selectedReport.severity].color}
                />
              </div>
              <p className="text-xs text-muted-foreground mb-2">{selectedReport.description}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {selectedReport.address}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {new Date(selectedReport.createdAt).toLocaleDateString("ro-RO", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </GlassCard>
          </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Route planner panel */}
      <AnimatePresence>
        {showRoutePlanner && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[999] bg-black/30 lg:hidden"
              onClick={() => setShowRoutePlanner(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              className="absolute top-4 left-4 z-[1001] w-80 sm:w-96 max-h-[calc(100vh-8rem)] overflow-y-auto"
            >
              <div className="rounded-xl p-4 bg-[#0f1729] border border-white/10">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Navigation2 className="h-5 w-5 text-accent" />
                    <span className="text-sm font-semibold font-[family-name:var(--font-heading)]">
                      Planificator Rută Velo
                    </span>
                  </div>
                  <button onClick={() => { setShowRoutePlanner(false); resetRoute(); }} className="text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* ── Start point ── */}
                <div className="space-y-1.5 mb-3">
                  <label className="text-[11px] font-medium text-green-400 flex items-center gap-1">
                    <div className="h-2.5 w-2.5 rounded-full bg-green-500" /> Punct de plecare
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      value={startAddress}
                      onChange={(e) => setStartAddress(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleGeocodeStart()}
                      placeholder="Adresă sau apasă pe hartă"
                      className="flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-green-500/60"
                    />
                    <Button size="sm" variant="outline" className="px-2 h-7 text-[10px]" onClick={handleGeocodeStart} disabled={!startAddress.trim()}>
                      <MapPin className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="outline" className="px-2 h-7 text-[10px]" onClick={() => handleUseGPS("start")}>
                      <LocateFixed className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant={routePickerMode === "start" ? "default" : "outline"}
                      className="px-2 h-7 text-[10px]"
                      onClick={() => setRoutePickerMode(routePickerMode === "start" ? null : "start")}
                    >
                      <Crosshair className="h-3 w-3" />
                    </Button>
                  </div>
                  {routeStart && (
                    <p className="text-[10px] text-green-400/70">{routeStart.lat.toFixed(5)}, {routeStart.lng.toFixed(5)}</p>
                  )}
                </div>

                {/* ── End point ── */}
                <div className="space-y-1.5 mb-3">
                  <label className="text-[11px] font-medium text-red-400 flex items-center gap-1">
                    <div className="h-2.5 w-2.5 rounded-full bg-red-500" /> Destinație
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      value={endAddress}
                      onChange={(e) => setEndAddress(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleGeocodeEnd()}
                      placeholder="Adresă sau apasă pe hartă"
                      className="flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-red-500/60"
                    />
                    <Button size="sm" variant="outline" className="px-2 h-7 text-[10px]" onClick={handleGeocodeEnd} disabled={!endAddress.trim()}>
                      <MapPin className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="outline" className="px-2 h-7 text-[10px]" onClick={() => handleUseGPS("end")}>
                      <LocateFixed className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant={routePickerMode === "end" ? "default" : "outline"}
                      className="px-2 h-7 text-[10px]"
                      onClick={() => setRoutePickerMode(routePickerMode === "end" ? null : "end")}
                    >
                      <Crosshair className="h-3 w-3" />
                    </Button>
                  </div>
                  {routeEnd && (
                    <p className="text-[10px] text-red-400/70">{routeEnd.lat.toFixed(5)}, {routeEnd.lng.toFixed(5)}</p>
                  )}
                </div>

                {(geocodeError || routeError) && (
                  <p className="text-[11px] text-red-400 mb-2">{geocodeError || routeError}</p>
                )}

                {routePickerMode && (
                  <p className="text-[11px] text-accent animate-pulse mb-2">
                    👆 Apasă pe hartă pentru a selecta {routePickerMode === "start" ? "punctul de plecare" : "destinația"}
                  </p>
                )}

                <div className="flex gap-2 mb-3">
                  <Button
                    variant="accent"
                    size="sm"
                    className="flex-1 text-xs"
                    disabled={!routeStart || !routeEnd || routeLoading}
                    onClick={calculateRoute}
                  >
                    {routeLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Navigation className="h-3 w-3 mr-1" />}
                    Calculează ruta
                  </Button>
                  <Button variant="ghost" size="sm" className="text-xs" onClick={resetRoute}>
                    Resetează
                  </Button>
                </div>

                {loadingVeloNetwork && (
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1 mb-2">
                    <Loader2 className="h-3 w-3 animate-spin" /> Se încarcă rețeaua velo...
                  </p>
                )}

                {/* Velo distance */}
                {veloDistKm != null && (
                  <div className="rounded-md bg-surface-light px-3 py-2 text-xs flex items-center justify-between mb-2">
                    <span className="text-muted-foreground">Ruta velo (client):</span>
                    <span className="font-semibold text-accent">{veloDistKm.toFixed(2)} km</span>
                  </div>
                )}

                {/* Backend route results */}
                {bikeRoute?.found && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg bg-surface-light p-2 text-center">
                        <Gauge className="h-3 w-3 mx-auto mb-1 text-primary" />
                        <p className="text-xs font-semibold">{(bikeRoute.totalDistanceM / 1000).toFixed(1)} km</p>
                        <p className="text-[10px] text-muted-foreground">Distanță</p>
                      </div>
                      <div className="rounded-lg bg-surface-light p-2 text-center">
                        <Clock className="h-3 w-3 mx-auto mb-1 text-primary" />
                        <p className="text-xs font-semibold">{bikeRoute.totalTimeMin} min</p>
                        <p className="text-[10px] text-muted-foreground">Durată</p>
                      </div>
                      <div className="rounded-lg bg-surface-light p-2 text-center">
                        <Shield className="h-3 w-3 mx-auto mb-1 text-primary" />
                        <p className="text-xs font-semibold">{bikeRoute.safetyAvg}%</p>
                        <p className="text-[10px] text-muted-foreground">Siguranță</p>
                      </div>
                      <div className="rounded-lg bg-surface-light p-2 text-center">
                        <Bike className="h-3 w-3 mx-auto mb-1 text-primary" />
                        <p className="text-xs font-semibold">{bikeRoute.bikeLanePercent}%</p>
                        <p className="text-[10px] text-muted-foreground">Pistă ciclabilă</p>
                      </div>
                    </div>

                    {/* Route legend */}
                    <div className="space-y-0.5">
                      <p className="text-[10px] font-medium text-muted-foreground">Legendă traseu</p>
                      {[
                        { color: "bg-emerald-400", label: "Pistă ciclabilă" },
                        { color: "bg-lime-300", label: "Zonă pietonală" },
                        { color: "bg-amber-400", label: "Bandă partajată" },
                        { color: "bg-rose-500", label: "Drum auto (periculos)" },
                        { color: "bg-yellow-300", label: "Punct sigur sugerit" },
                      ].map((item) => (
                        <div key={item.label} className="flex items-center gap-1.5">
                          <div className={cn("h-2 w-2 rounded-full", item.color)} />
                          <span className="text-[10px] text-muted-foreground">{item.label}</span>
                        </div>
                      ))}
                    </div>

                    {bikeRoute.safeSpots.length > 0 && (
                      <div>
                        <p className="text-[10px] font-medium text-yellow-400 mb-1">
                          ⚠ Zone fără pistă ciclabilă – puncte sigure sugerate:
                        </p>
                        {bikeRoute.safeSpots.slice(0, 4).map((spot, idx) => (
                          <p key={idx} className="text-[10px] text-muted-foreground pl-2">
                            • {spot.name}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ═══ Floating Action Button cluster ═══ */}
      <div className="absolute bottom-6 right-4 z-[1100] flex flex-col-reverse items-end gap-3">
        {/* Sub-buttons (visible when FAB open) */}
        <AnimatePresence>
          {fabOpen && (
            <>
              {/* Velo route button */}
              <motion.button
                initial={{ opacity: 0, scale: 0.4, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.4, y: 20 }}
                transition={{ type: "spring", stiffness: 400, damping: 22 }}
                onClick={() => {
                  setFabOpen(false);
                  setShowRoutePlanner(!showRoutePlanner);
                  if (showRoutePlanner) resetRoute();
                }}
                className={cn(
                  "flex items-center gap-3 pl-4 pr-5 py-3.5 rounded-full shadow-xl transition-colors",
                  "backdrop-blur-xl border border-white/10",
                  showRoutePlanner
                    ? "bg-surface-light/90 text-foreground"
                    : "bg-accent/90 text-accent-foreground"
                )}
              >
                <Bike className="h-5 w-5 shrink-0" />
                <span className="text-sm font-semibold whitespace-nowrap">
                  {showRoutePlanner ? "Închide ruta" : "Rută velo"}
                </span>
              </motion.button>

              {/* Quick report button */}
              <motion.button
                initial={{ opacity: 0, scale: 0.4, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.4, y: 20 }}
                transition={{ type: "spring", stiffness: 400, damping: 22, delay: 0.04 }}
                onClick={openQuickReport}
                className="flex items-center gap-3 pl-4 pr-5 py-3.5 rounded-full shadow-xl backdrop-blur-xl border border-white/10 bg-red-500/90 text-white transition-colors"
              >
                <Megaphone className="h-5 w-5 shrink-0" />
                <span className="text-sm font-semibold whitespace-nowrap">Raportează</span>
              </motion.button>
            </>
          )}
        </AnimatePresence>

        {/* Main FAB */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => setFabOpen((o) => !o)}
          className={cn(
            "h-16 w-16 rounded-full shadow-2xl flex items-center justify-center transition-colors",
            "backdrop-blur-xl border border-white/15",
            fabOpen ? "bg-surface-light/90" : "bg-accent/90"
          )}
        >
          <motion.div animate={{ rotate: fabOpen ? 45 : 0 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
            <Plus className={cn("h-6 w-6", fabOpen ? "text-foreground" : "text-accent-foreground")} />
          </motion.div>
        </motion.button>
      </div>

      {/* Scrim behind FAB when open */}
      <AnimatePresence>
        {fabOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[1099] bg-black/20"
            onClick={() => setFabOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Computing overlay */}
      {(isVeloRouting || routeLoading) && (
        <div className="absolute inset-x-0 bottom-24 flex justify-center z-[1000] pointer-events-none">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="pointer-events-auto">
            <GlassCard className="px-3 py-2 text-xs flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              Se calculează ruta...
            </GlassCard>
          </motion.div>
        </div>
      )}

      {/* ═══ Quick Report Bottom Sheet ═══ */}
      <AnimatePresence>
        {showQuickReport && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[1200] bg-black/40"
              onClick={() => !reportSubmitting && setShowQuickReport(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 340, damping: 30 }}
              className="absolute bottom-0 inset-x-0 z-[1201] max-h-[70vh] overflow-y-auto"
            >
              <div className="rounded-t-2xl border-t border-white/10 px-4 pt-3 pb-6 safe-area-bottom bg-[#0f1729]">
                {/* Drag handle */}
                <div className="flex justify-center mb-3">
                  <div className="h-1 w-10 rounded-full bg-white/20" />
                </div>

                {reportSuccess ? (
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex flex-col items-center gap-3 py-8"
                  >
                    <div className="h-14 w-14 rounded-full bg-green-500/20 flex items-center justify-center">
                      <CheckCircle className="h-7 w-7 text-green-400" />
                    </div>
                    <p className="text-sm font-semibold text-green-400">Raport trimis!</p>
                    <p className="text-xs text-muted-foreground">Mulțumim pentru contribuție.</p>
                  </motion.div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-sm font-bold font-[family-name:var(--font-heading)]">
                          Raportează o problemă
                        </h3>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Selectează tipul — trimitem automat locația ta GPS
                        </p>
                      </div>
                      <button
                        onClick={() => setShowQuickReport(false)}
                        className="p-1.5 rounded-lg hover:bg-surface-light text-muted-foreground"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    {reportError && (
                      <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 mb-3">
                        <p className="text-xs text-red-400">{reportError}</p>
                      </div>
                    )}

                    {!gpsPosition && !reportError && (
                      <div className="flex items-center gap-2 rounded-lg bg-accent/10 border border-accent/20 px-3 py-2 mb-3">
                        <Loader2 className="h-3 w-3 animate-spin text-accent" />
                        <p className="text-xs text-accent">Se obține localizarea GPS...</p>
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-2">
                      {quickReportCategories.map((cat) => {
                        const Icon = cat.icon;
                        const isSubmitting = reportSubmitting === cat.id;
                        return (
                          <motion.button
                            key={cat.id}
                            whileTap={{ scale: 0.92 }}
                            disabled={!!reportSubmitting || !gpsPosition}
                            onClick={() => submitQuickReport(cat.id)}
                            className={cn(
                              "flex flex-col items-center gap-1.5 rounded-xl p-3 transition-colors",
                              "border border-white/5 bg-surface-light/50",
                              "hover:bg-surface-light hover:border-white/10",
                              "disabled:opacity-40 disabled:pointer-events-none",
                              "active:bg-surface-light"
                            )}
                          >
                            {isSubmitting ? (
                              <Loader2 className="h-6 w-6 animate-spin text-accent" />
                            ) : (
                              <Icon className={cn("h-6 w-6", cat.color)} />
                            )}
                            <span className="text-[10px] font-medium text-foreground/80 leading-tight text-center">
                              {cat.label}
                            </span>
                          </motion.button>
                        );
                      })}
                    </div>

                    {gpsPosition && (
                      <p className="text-[10px] text-muted-foreground/60 text-center mt-3 flex items-center justify-center gap-1">
                        <LocateFixed className="h-3 w-3" />
                        {gpsPosition.lat.toFixed(5)}, {gpsPosition.lng.toFixed(5)}
                      </p>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </PageTransition>
  );
}
