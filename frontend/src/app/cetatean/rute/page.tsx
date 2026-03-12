"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { MapPin, Navigation2, Crosshair, Loader2 } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { PageTransition } from "@/components/ui/page-transition";

const BikeRouteMap = dynamic(() => import("./route-map").then((mod) => mod.BikeRouteMap), {
  ssr: false,
});

type LatLng = { lat: number; lng: number };

interface BikeGeoJsonFeature {
  type: "Feature";
  geometry: {
    type: "LineString" | "MultiLineString";
    coordinates: number[][] | number[][][];
  };
  properties: {
    Lungime?: number;
    [key: string]: unknown;
  };
}

interface BikeGeoJsonCollection {
  type: "FeatureCollection";
  features: BikeGeoJsonFeature[];
}

type NetworkType = "principala" | "secundara";

interface NetworkPolyline {
  coords: LatLng[];
  type: NetworkType;
}

interface StreetGeoJsonFeature {
  type: "Feature";
  geometry: {
    type: "LineString" | "MultiLineString";
    coordinates: number[][] | number[][][];
  };
  properties: {
    lungime?: number;
    tipstrada?: string;
    strada?: string;
    [key: string]: unknown;
  };
}

interface StreetGeoJsonCollection {
  type: "FeatureCollection";
  features: StreetGeoJsonFeature[];
}

interface Graph {
  nodes: LatLng[];
  edges: Map<number, { to: number; weight: number }[]>;
  // Store the full geometry for each edge so routes follow the actual road shape
  edgeGeometry: Map<string, LatLng[]>;
}

function edgeGeoKey(a: number, b: number): string {
  return `${a}-${b}`;
}

/**
 * Creates an addNode function that merges points within a radius
 * instead of using grid-cell snapping (which fails at cell boundaries).
 */
function createSpatialNodeAdder(nodes: LatLng[], mergeRadiusKm = 0.015) {
  const CELL_LAT = 0.0002; // ~22 m
  const CELL_LNG = 0.0003; // ~24 m
  const grid = new Map<string, number[]>();

  const cellKey = (lat: number, lng: number) =>
    `${Math.floor(lat / CELL_LAT)}_${Math.floor(lng / CELL_LNG)}`;

  return (coord: LatLng): number => {
    const ck = cellKey(coord.lat, coord.lng);
    const parts = ck.split("_");
    const cy = Number(parts[0]);
    const cx = Number(parts[1]);

    let bestIdx = -1;
    let bestDist = mergeRadiusKm;

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const bucket = grid.get(`${cy + dy}_${cx + dx}`);
        if (!bucket) continue;
        for (const idx of bucket) {
          const d = haversineKm(coord, nodes[idx]);
          if (d < bestDist) {
            bestDist = d;
            bestIdx = idx;
          }
        }
      }
    }

    if (bestIdx >= 0) return bestIdx;

    const idx = nodes.length;
    nodes.push(coord);
    if (!grid.has(ck)) grid.set(ck, []);
    grid.get(ck)!.push(idx);
    return idx;
  };
}

function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R * c;
}

function buildNetworkAndGraph(
  principale: BikeGeoJsonCollection | null,
  secundare: BikeGeoJsonCollection | null
): { polylines: NetworkPolyline[]; graph: Graph | null } {
  if (!principale && !secundare) return { polylines: [], graph: null };

  const polylines: NetworkPolyline[] = [];
  const nodes: LatLng[] = [];
  const edges = new Map<number, { to: number; weight: number }[]>();
  const edgeGeometry = new Map<string, LatLng[]>();
  const addNode = createSpatialNodeAdder(nodes);

  const addEdge = (a: number, b: number, weight: number, geometry?: LatLng[]) => {
    if (!edges.has(a)) edges.set(a, []);
    if (!edges.has(b)) edges.set(b, []);
    edges.get(a)!.push({ to: b, weight });
    edges.get(b)!.push({ to: a, weight });
    // Always store geometry; snap endpoints to canonical node positions to prevent gaps
    const geo = geometry && geometry.length > 1
      ? [nodes[a], ...geometry.slice(1, -1), nodes[b]]
      : [nodes[a], nodes[b]];
    edgeGeometry.set(edgeGeoKey(a, b), geo);
    edgeGeometry.set(edgeGeoKey(b, a), [...geo].reverse());
  };

  const processCollection = (
    collection: BikeGeoJsonCollection | null,
    type: NetworkType
  ) => {
    if (!collection) return;

    for (const feature of collection.features) {
      if (!feature.geometry) continue;
      const { geometry } = feature;

      const handleLine = (coords: number[][]) => {
        if (coords.length < 2) return;
        const latlngs: LatLng[] = coords.map(([lng, lat]) => ({ lat, lng }));
        polylines.push({ coords: latlngs, type });

        // Build edges between consecutive distinct nodes, storing intermediate geometry
        let prevIdx = addNode(latlngs[0]);
        let geoAccum: LatLng[] = [latlngs[0]];

        for (let i = 1; i < latlngs.length; i++) {
          const curIdx = addNode(latlngs[i]);
          geoAccum.push(latlngs[i]);
          if (curIdx !== prevIdx) {
            const base = computePathDistance(geoAccum);
            const factor = type === "principala" ? 0.9 : 1.0;
            addEdge(prevIdx, curIdx, base * factor, geoAccum);
            prevIdx = curIdx;
            geoAccum = [latlngs[i]];
          }
        }
      };

      if (geometry.type === "LineString") {
        handleLine(geometry.coordinates as number[][]);
      } else if (geometry.type === "MultiLineString") {
        for (const part of geometry.coordinates as number[][][]) {
          handleLine(part);
        }
      }
    }
  };

  processCollection(principale, "principala");
  processCollection(secundare, "secundara");

  if (!nodes.length) return { polylines, graph: null };

  return { polylines, graph: { nodes, edges, edgeGeometry } };
}

function buildStreetGraph(strazi: StreetGeoJsonCollection | null): Graph | null {
  if (!strazi) return null;

  const nodes: LatLng[] = [];
  const edges = new Map<number, { to: number; weight: number }[]>();
  const edgeGeometry = new Map<string, LatLng[]>();
  const edgeSet = new Set<string>();
  const addNode = createSpatialNodeAdder(nodes);

  const addEdge = (a: number, b: number, weight: number, geometry?: LatLng[]) => {
    if (a === b) return;
    const key1 = `${a}-${b}`;
    const key2 = `${b}-${a}`;
    if (edgeSet.has(key1) || edgeSet.has(key2)) return;
    edgeSet.add(key1);
    if (!edges.has(a)) edges.set(a, []);
    if (!edges.has(b)) edges.set(b, []);
    edges.get(a)!.push({ to: b, weight });
    edges.get(b)!.push({ to: a, weight });
    // Always store geometry; snap endpoints to canonical node positions to prevent gaps
    const geo = geometry && geometry.length > 1
      ? [nodes[a], ...geometry.slice(1, -1), nodes[b]]
      : [nodes[a], nodes[b]];
    edgeGeometry.set(edgeGeoKey(a, b), geo);
    edgeGeometry.set(edgeGeoKey(b, a), [...geo].reverse());
  };

  for (const feature of strazi.features) {
    if (!feature.geometry) continue;
    const { geometry, properties } = feature;

    let rings: number[][][] = [];
    if (geometry.type === "LineString") {
      rings = [geometry.coordinates as number[][]];
    } else if (geometry.type === "MultiLineString") {
      rings = geometry.coordinates as number[][][];
    }

    for (const coords of rings) {
      if (!coords || coords.length < 2) continue;
      const latlngs: LatLng[] = coords.map(([lng, lat]) => ({ lat, lng }));

      let prevIdx = addNode(latlngs[0]);
      let geoAccum: LatLng[] = [latlngs[0]];

      for (let i = 1; i < latlngs.length; i++) {
        const curIdx = addNode(latlngs[i]);
        geoAccum.push(latlngs[i]);
        if (curIdx !== prevIdx) {
          const base = computePathDistance(geoAccum);
          addEdge(prevIdx, curIdx, base, geoAccum);
          prevIdx = curIdx;
          geoAccum = [latlngs[i]];
        }
      }
    }
  }

  // Connect nearby dangling nodes to bridge small gaps between centerlines
  const thresholdKm = 0.02; // ~20m
  const cellSize = 0.001; // ~100m grid for bucketing
  const grid = new Map<string, number[]>();

  const cellKey = (lat: number, lng: number) =>
    `${Math.floor(lat / cellSize)}_${Math.floor(lng / cellSize)}`;

  nodes.forEach((n, idx) => {
    const key = cellKey(n.lat, n.lng);
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key)!.push(idx);
  });

  nodes.forEach((n, i) => {
    const baseKey = cellKey(n.lat, n.lng);
    const [cyStr, cxStr] = baseKey.split("_");
    const cy = Number(cyStr);
    const cx = Number(cxStr);

    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const key = `${cy + dy}_${cx + dx}`;
        const bucket = grid.get(key);
        if (!bucket) continue;
        for (const j of bucket) {
          if (j <= i) continue;
          const d = haversineKm(n, nodes[j]);
          if (d <= thresholdKm) {
            addEdge(i, j, d);
          }
        }
      }
    }
  });

  if (!nodes.length) return null;
  return { nodes, edges, edgeGeometry };
}

function distanceToBikeNetwork(point: LatLng, polylines: NetworkPolyline[]): number {
  let best = Infinity;
  for (const line of polylines) {
    const coords = line.coords;
    for (let i = 0; i < coords.length; i++) {
      const d = haversineKm(point, coords[i]);
      if (d < best) best = d;
    }
  }
  return best;
}

function sampleStraightLine(start: LatLng, end: LatLng, steps = 40): LatLng[] {
  const samples: LatLng[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    samples.push({
      lat: start.lat + (end.lat - start.lat) * t,
      lng: start.lng + (end.lng - start.lng) * t,
    });
  }
  return samples;
}

function findNearestNodeWithDist(
  graph: Graph,
  point: LatLng
): { idx: number; distKm: number } | null {
  let bestIdx: number | null = null;
  let bestDist = Infinity;
  for (let i = 0; i < graph.nodes.length; i++) {
    const d = haversineKm(point, graph.nodes[i]);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  if (bestIdx == null) return null;
  return { idx: bestIdx, distKm: bestDist };
}

function computePathDistance(coords: LatLng[]): number {
  let total = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    total += haversineKm(coords[i], coords[i + 1]);
  }
  return total;
}

// Reconstruct a smooth path from Dijkstra node indices using stored edge geometry.
// All edge geometries are snapped to canonical node positions, so segments
// connect exactly at shared nodes with zero gaps.
function reconstructPath(graph: Graph, nodeIndices: number[]): LatLng[] {
  if (nodeIndices.length === 0) return [];
  if (nodeIndices.length === 1) return [graph.nodes[nodeIndices[0]]];

  const result: LatLng[] = [graph.nodes[nodeIndices[0]]];
  for (let i = 0; i < nodeIndices.length - 1; i++) {
    const a = nodeIndices[i];
    const b = nodeIndices[i + 1];
    const geo = graph.edgeGeometry.get(edgeGeoKey(a, b));
    if (geo && geo.length > 1) {
      // Skip first point (it equals canonical nodes[a] which is already in result)
      for (let j = 1; j < geo.length; j++) {
        result.push(geo[j]);
      }
    } else {
      // Fallback: straight to next canonical node
      result.push(graph.nodes[b]);
    }
  }
  return result;
}

function routeOnStreetGraph(
  graph: Graph,
  startPoint: LatLng,
  endPoint: LatLng
): { coords: LatLng[]; distKm: number } | null {
  const start = findNearestNodeWithDist(graph, startPoint);
  const end = findNearestNodeWithDist(graph, endPoint);
  if (!start || !end) return null;
  
  const res = dijkstra(graph, start.idx, end.idx);
  
  if (res) {
    const pathCoords = reconstructPath(graph, res.path);
    const fullPath = [startPoint, ...pathCoords, endPoint];
    const total = computePathDistance(fullPath);
    return {
      coords: fullPath,
      distKm: total,
    };
  }
  
  // Fallback: no path found in graph (disconnected components)
  // Try to find intermediate waypoints along the straight line
  const samples = sampleStraightLine(startPoint, endPoint, 20);
  const waypoints: LatLng[] = [startPoint];
  
  for (const sample of samples.slice(1, -1)) {
    const nearest = findNearestNodeWithDist(graph, sample);
    if (nearest && nearest.distKm < 0.1) { // within 100m
      const node = graph.nodes[nearest.idx];
      const lastWp = waypoints[waypoints.length - 1];
      if (haversineKm(lastWp, node) > 0.02) {
        waypoints.push(node);
      }
    }
  }
  
  waypoints.push(endPoint);
  
  return {
    coords: waypoints,
    distKm: computePathDistance(waypoints),
  };
}

function findNearestNode(graph: Graph, point: LatLng): number | null {
  let bestIdx: number | null = null;
  let bestDist = Infinity;
  for (let i = 0; i < graph.nodes.length; i++) {
    const d = haversineKm(point, graph.nodes[i]);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  return bestIdx;
}

function dijkstra(graph: Graph, start: number, target: number): { path: number[]; distanceKm: number } | null {
  const n = graph.nodes.length;
  const dist = new Float64Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  dist[start] = 0;

  // Binary min-heap: [distance, nodeIndex]
  const heap: [number, number][] = [[0, start]];

  while (heap.length > 0) {
    // Pop min
    const [d, u] = heap[0];
    const last = heap.pop()!;
    if (heap.length > 0) {
      heap[0] = last;
      let i = 0;
      while (true) {
        let smallest = i;
        const l = 2 * i + 1, r = 2 * i + 2;
        if (l < heap.length && heap[l][0] < heap[smallest][0]) smallest = l;
        if (r < heap.length && heap[r][0] < heap[smallest][0]) smallest = r;
        if (smallest === i) break;
        [heap[i], heap[smallest]] = [heap[smallest], heap[i]];
        i = smallest;
      }
    }

    if (d > dist[u]) continue;
    if (u === target) break;

    const neighbors = graph.edges.get(u);
    if (!neighbors) continue;
    for (let k = 0; k < neighbors.length; k++) {
      const { to, weight } = neighbors[k];
      const alt = dist[u] + weight;
      if (alt < dist[to]) {
        dist[to] = alt;
        prev[to] = u;
        // Push to heap with sift-up
        let idx = heap.length;
        heap.push([alt, to]);
        while (idx > 0) {
          const parent = (idx - 1) >> 1;
          if (heap[parent][0] <= heap[idx][0]) break;
          [heap[parent], heap[idx]] = [heap[idx], heap[parent]];
          idx = parent;
        }
      }
    }
  }

  if (!isFinite(dist[target])) return null;

  const path: number[] = [];
  let u = target;
  while (u !== -1) {
    path.push(u);
    u = prev[u];
  }
  path.reverse();

  return { path, distanceKm: dist[target] };
}

export default function BikeRoutesPage() {
  const [principale, setPrincipale] = useState<BikeGeoJsonCollection | null>(null);
  const [secundare, setSecundare] = useState<BikeGeoJsonCollection | null>(null);
  const [strazi, setStrazi] = useState<StreetGeoJsonCollection | null>(null);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [loadingNetwork, setLoadingNetwork] = useState(true);

  const [startPoint, setStartPoint] = useState<LatLng | null>(null);
  const [endPoint, setEndPoint] = useState<LatLng | null>(null);
  const [bikeRouteCoords, setBikeRouteCoords] = useState<LatLng[]>([]);
  const [accessRouteCoords, setAccessRouteCoords] = useState<LatLng[]>([]);
  const [egressRouteCoords, setEgressRouteCoords] = useState<LatLng[]>([]);
  const [routeDistanceKm, setRouteDistanceKm] = useState<number | null>(null);
  const [isRouting, setIsRouting] = useState(false);
  const [address, setAddress] = useState("");
  const [geocodeError, setGeocodeError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoadingNetwork(true);
        const [pRes, sRes, stRes] = await Promise.all([
          fetch("/data/principale.geojson"),
          fetch("/data/secundare.geojson"),
          fetch("/data/strazi_centerline.geojson"),
        ]);
        if (!pRes.ok || !sRes.ok || !stRes.ok) {
          throw new Error("Nu s-au putut încărca datele pentru rutele velo și străzi.");
        }
        const pJson = (await pRes.json()) as BikeGeoJsonCollection;
        const sJson = (await sRes.json()) as BikeGeoJsonCollection;
        const stJson = (await stRes.json()) as StreetGeoJsonCollection;
        setPrincipale(pJson);
        setSecundare(sJson);
        setStrazi(stJson);
        setNetworkError(null);
      } catch (err) {
        console.error(err);
        setNetworkError("Nu am putut încărca rețeaua de piste. Încearcă să reîncarci pagina.");
      } finally {
        setLoadingNetwork(false);
      }
    };
    load();
  }, []);

  const { polylines, graph } = useMemo(
    () => buildNetworkAndGraph(principale, secundare),
    [principale, secundare]
  );

  const streetGraph = useMemo(() => buildStreetGraph(strazi), [strazi]);

  const handleGeocodeAddress = async () => {
    if (!address.trim()) return;
    try {
      setGeocodeError(null);
      const query = encodeURIComponent(`${address}, București, România`);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`
      );
      if (!res.ok) {
        throw new Error("Geocodarea a eșuat.");
      }
      const data = await res.json();
      if (!data || data.length === 0) {
        setGeocodeError("Nu am găsit adresa. Încearcă să fii mai specific.");
        return;
      }
      const loc = data[0];
      const lat = parseFloat(loc.lat);
      const lng = parseFloat(loc.lon);
      setStartPoint({ lat, lng });
    } catch (err) {
      console.error(err);
      setGeocodeError("A apărut o eroare la conversia adresei în coordonate.");
    }
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setGeocodeError("Geolocalizarea nu este disponibilă în acest browser.");
      return;
    }
    setGeocodeError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setStartPoint({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      () => {
        setGeocodeError("Nu am putut accesa locația ta curentă.");
      }
    );
  };

  const handleComputeRoute = () => {
    if (!startPoint || !endPoint) return;
    setIsRouting(true);
    try {
      setBikeRouteCoords([]);
      setAccessRouteCoords([]);
      setEgressRouteCoords([]);
      setRouteDistanceKm(null);

      const hasStreet = !!streetGraph;
      const hasBike = !!graph;

      if (!hasStreet && !hasBike) {
        setNetworkError("Nu există suficiente date pentru a calcula ruta.");
        return;
      }

      // 1) Ruta doar pe stradă
      let streetRoute: { coords: LatLng[]; distKm: number } | null = null;
      if (streetGraph) {
        streetRoute = routeOnStreetGraph(streetGraph, startPoint, endPoint);
      }

      // 2) Ruta mixtă: stradă + pistă + stradă (dacă este posibil)
      type CandidateRoute = {
        coordsAccess: LatLng[];
        coordsBike: LatLng[];
        coordsEgress: LatLng[];
        totalKm: number;
        bikeKm: number;
      };

      let mixedRoute: CandidateRoute | null = null;

      if (hasBike && streetGraph) {
        const startBike = findNearestNodeWithDist(graph!, startPoint);
        const endBike = findNearestNodeWithDist(graph!, endPoint);

        const bikeSnapMaxKm = 0.3; // ~300m

        if (
          startBike &&
          endBike &&
          startBike.distKm <= bikeSnapMaxKm &&
          endBike.distKm <= bikeSnapMaxKm
        ) {
          const bikePath = dijkstra(graph!, startBike.idx, endBike.idx);
          if (bikePath) {
            const bikeCoords = reconstructPath(graph!, bikePath.path);

            const entryPoint = bikeCoords[0];
            const exitPoint = bikeCoords[bikeCoords.length - 1];

            const access = routeOnStreetGraph(streetGraph, startPoint, entryPoint);
            const egress = routeOnStreetGraph(streetGraph, exitPoint, endPoint);

            if (access && egress) {
              const bikeKm = bikeCoords.reduce((sum, p, i) => {
                if (i === 0) return sum;
                return sum + haversineKm(bikeCoords[i - 1], p);
              }, 0);

              const totalKm = access.distKm + bikeKm + egress.distKm;

              mixedRoute = {
                coordsAccess: access.coords,
                coordsBike: bikeCoords,
                coordsEgress: egress.coords,
                totalKm,
                bikeKm,
              };
            }
          }
        }
      }

      // 3) Alegerea finală după regulile de business
      if (!streetRoute && !mixedRoute) {
        setNetworkError(
          "Nu am reușit să calculez nicio rută validă pe baza datelor disponibile."
        );
        return;
      }

      // Dacă avem doar una dintre ele, o alegem direct
      if (streetRoute && !mixedRoute) {
        setAccessRouteCoords(streetRoute.coords);
        setBikeRouteCoords([]);
        setEgressRouteCoords([]);
        setRouteDistanceKm(streetRoute.distKm);
        setNetworkError(null);
        return;
      }

      if (!streetRoute && mixedRoute) {
        setAccessRouteCoords(mixedRoute.coordsAccess);
        setBikeRouteCoords(mixedRoute.coordsBike);
        setEgressRouteCoords(mixedRoute.coordsEgress);
        setRouteDistanceKm(mixedRoute.totalKm);
        setNetworkError(null);
        return;
      }

      // Ambele există: aplicăm toleranța
      const shortestKm = Math.min(streetRoute!.distKm, mixedRoute!.totalKm);
      const toleranceAbs = 0.3; // 300m
      const toleranceRel = 0.1; // 10%
      const tolerance = Math.max(toleranceAbs, shortestKm * toleranceRel);

      let chosen: "street" | "mixed";

      if (mixedRoute!.totalKm <= streetRoute!.distKm + tolerance) {
        // Ruta mixtă nu e mult mai lungă – dacă are pistă semnificativă, o preferăm
        chosen = mixedRoute!.bikeKm > 0 ? "mixed" : "street";
      } else {
        chosen = "street";
      }

      if (chosen === "street") {
        setAccessRouteCoords(streetRoute!.coords);
        setBikeRouteCoords([]);
        setEgressRouteCoords([]);
        setRouteDistanceKm(streetRoute!.distKm);
        setNetworkError(null);
      } else {
        setAccessRouteCoords(mixedRoute!.coordsAccess);
        setBikeRouteCoords(mixedRoute!.coordsBike);
        setEgressRouteCoords(mixedRoute!.coordsEgress);
        setRouteDistanceKm(mixedRoute!.totalKm);
        setNetworkError(null);
      }
    } finally {
      setIsRouting(false);
    }
  };

  useEffect(() => {
    if (graph && startPoint && endPoint) {
      handleComputeRoute();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, startPoint, endPoint]);

  return (
    <PageTransition className="h-[calc(100vh-3.5rem-3rem)] -m-4 lg:-m-6 relative">
      <BikeRouteMap
        networkPolylines={polylines}
        startPoint={startPoint}
        endPoint={endPoint}
        bikeRoute={bikeRouteCoords}
        accessRoute={accessRouteCoords}
        egressRoute={egressRouteCoords}
        onMapClick={setEndPoint}
      />

      <div className="absolute top-4 left-4 right-4 z-[1000] flex flex-col gap-3 max-w-xl">
        <GlassCard className="p-3 md:p-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <Navigation2 className="h-5 w-5 text-primary" />
              <span className="text-sm font-semibold font-[family-name:var(--font-heading)]">
                Planificator rute velo
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-muted-foreground">
                Punct de plecare (adresă în București)
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Ex: Piața Universității 1"
                  className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                />
                <Button
                  size="sm"
                  onClick={handleGeocodeAddress}
                  disabled={!address.trim()}
                  className="flex items-center gap-1"
                >
                  <MapPin className="h-4 w-4" />
                  Setează
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1 text-xs text-muted-foreground">
                Sau folosește <span className="font-medium">locația ta curentă</span> (GPS).
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleUseMyLocation}
                className="flex items-center gap-1"
              >
                <Crosshair className="h-4 w-4" />
                GPS
              </Button>
            </div>

            <p className="text-[11px] text-muted-foreground">
              Apoi apasă pe hartă pentru a alege destinația (pinul roșu). Ruta propusă va folosi rețeaua de piste
              de biciclete principale și secundare, iar unde nu există pistă va desena o legătură aproximativă pe stradă.
            </p>

            {routeDistanceKm != null && (
              <div className="mt-2 rounded-md bg-surface-light px-3 py-2 text-xs flex items-center justify-between">
                <span className="text-muted-foreground">Distanță estimată pe rețeaua velo:</span>
                <span className="font-semibold">
                  {routeDistanceKm.toFixed(2)} km
                </span>
              </div>
            )}

            {(geocodeError || networkError) && (
              <p className="text-[11px] text-red-500 mt-1">
                {geocodeError || networkError}
              </p>
            )}
          </div>
        </GlassCard>

        {loadingNetwork && (
          <GlassCard className="p-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Se încarcă rețeaua de piste de biciclete din București...
          </GlassCard>
        )}
      </div>

      {isRouting && (
        <div className="absolute inset-x-0 bottom-4 flex justify-center z-[1000] pointer-events-none">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="pointer-events-auto"
          >
            <GlassCard className="px-3 py-2 text-xs flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              Calculăm cea mai rapidă rută pe rețeaua velo...
            </GlassCard>
          </motion.div>
        </div>
      )}
    </PageTransition>
  );
}
