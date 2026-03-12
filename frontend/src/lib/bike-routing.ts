/**
 * Client-side bike routing engine.
 * Builds graphs from principale / secundare / strazi GeoJSON and runs Dijkstra.
 */

// ─── Types ──────────────────────────────────────────
export type LatLng = { lat: number; lng: number };
export type NetworkType = "principala" | "secundara";

export interface NetworkPolyline {
  coords: LatLng[];
  type: NetworkType;
}

export interface BikeGeoJsonFeature {
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

export interface BikeGeoJsonCollection {
  type: "FeatureCollection";
  features: BikeGeoJsonFeature[];
}

export interface StreetGeoJsonFeature {
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

export interface StreetGeoJsonCollection {
  type: "FeatureCollection";
  features: StreetGeoJsonFeature[];
}

export interface Graph {
  nodes: LatLng[];
  edges: Map<number, { to: number; weight: number }[]>;
  edgeGeometry: Map<string, LatLng[]>;
}

export interface ClientRouteResult {
  accessCoords: LatLng[];
  bikeCoords: LatLng[];
  egressCoords: LatLng[];
  totalKm: number;
  bikeKm: number;
  bikeLanePercent: number;
  estimatedTimeMin: number;
}

// ─── Helpers ────────────────────────────────────────

export function edgeGeoKey(a: number, b: number): string {
  return `${a}-${b}`;
}

export function haversineKm(a: LatLng, b: LatLng): number {
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

export function computePathDistance(coords: LatLng[]): number {
  let total = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    total += haversineKm(coords[i], coords[i + 1]);
  }
  return total;
}

function createSpatialNodeAdder(nodes: LatLng[], mergeRadiusKm = 0.015) {
  const CELL_LAT = 0.0002;
  const CELL_LNG = 0.0003;
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

// ─── Graph building ─────────────────────────────────

export function buildNetworkAndGraph(
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
    const geo =
      geometry && geometry.length > 1
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

export function buildStreetGraph(strazi: StreetGeoJsonCollection | null): Graph | null {
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
    const geo =
      geometry && geometry.length > 1
        ? [nodes[a], ...geometry.slice(1, -1), nodes[b]]
        : [nodes[a], nodes[b]];
    edgeGeometry.set(edgeGeoKey(a, b), geo);
    edgeGeometry.set(edgeGeoKey(b, a), [...geo].reverse());
  };

  for (const feature of strazi.features) {
    if (!feature.geometry) continue;
    const { geometry } = feature;

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

  // Bridge nearby dangling nodes
  const thresholdKm = 0.02;
  const cellSize = 0.001;
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

// ─── Dijkstra ───────────────────────────────────────

export function dijkstra(
  graph: Graph,
  start: number,
  target: number
): { path: number[]; distanceKm: number } | null {
  const n = graph.nodes.length;
  const dist = new Float64Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  dist[start] = 0;

  const heap: [number, number][] = [[0, start]];

  while (heap.length > 0) {
    const [d, u] = heap[0];
    const last = heap.pop()!;
    if (heap.length > 0) {
      heap[0] = last;
      let i = 0;
      while (true) {
        let smallest = i;
        const l = 2 * i + 1,
          r = 2 * i + 2;
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

// ─── Path reconstruction & routing ──────────────────

export function reconstructPath(graph: Graph, nodeIndices: number[]): LatLng[] {
  if (nodeIndices.length === 0) return [];
  if (nodeIndices.length === 1) return [graph.nodes[nodeIndices[0]]];

  const result: LatLng[] = [graph.nodes[nodeIndices[0]]];
  for (let i = 0; i < nodeIndices.length - 1; i++) {
    const a = nodeIndices[i];
    const b = nodeIndices[i + 1];
    const geo = graph.edgeGeometry.get(edgeGeoKey(a, b));
    if (geo && geo.length > 1) {
      for (let j = 1; j < geo.length; j++) {
        result.push(geo[j]);
      }
    } else {
      result.push(graph.nodes[b]);
    }
  }
  return result;
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

export function routeOnStreetGraph(
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
    return { coords: fullPath, distKm: total };
  }

  // Fallback: waypoints along straight line
  const samples = sampleStraightLine(startPoint, endPoint, 20);
  const waypoints: LatLng[] = [startPoint];

  for (const sample of samples.slice(1, -1)) {
    const nearest = findNearestNodeWithDist(graph, sample);
    if (nearest && nearest.distKm < 0.1) {
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

// ─── Full route computation ─────────────────────────

const AVG_CYCLING_SPEED_KMH = 15;

export function computeFullRoute(
  startPoint: LatLng,
  endPoint: LatLng,
  bikeGraph: Graph | null,
  streetGraph: Graph | null,
  polylines: NetworkPolyline[]
): ClientRouteResult | null {
  const hasStreet = !!streetGraph;
  const hasBike = !!bikeGraph;

  if (!hasStreet && !hasBike) return null;

  // 1) Street-only route (fallback)
  let streetRoute: { coords: LatLng[]; distKm: number } | null = null;
  if (streetGraph) {
    streetRoute = routeOnStreetGraph(streetGraph, startPoint, endPoint);
  }

  // 2) Mixed route: street → bike lane → street
  type CandidateRoute = {
    coordsAccess: LatLng[];
    coordsBike: LatLng[];
    coordsEgress: LatLng[];
    totalKm: number;
    bikeKm: number;
  };

  let mixedRoute: CandidateRoute | null = null;

  if (hasBike && streetGraph) {
    const bikeSnapMaxKm = 5.0; // find closest bike lane in urban area

    const startBike = findNearestNodeWithDist(bikeGraph!, startPoint);
    const endBike = findNearestNodeWithDist(bikeGraph!, endPoint);

    if (
      startBike &&
      endBike &&
      startBike.distKm <= bikeSnapMaxKm &&
      endBike.distKm <= bikeSnapMaxKm
    ) {
      const bikePath = dijkstra(bikeGraph!, startBike.idx, endBike.idx);
      if (bikePath) {
        const bikeCoords = reconstructPath(bikeGraph!, bikePath.path);
        if (bikeCoords.length >= 2) {
          const entryPoint = bikeCoords[0];
          const exitPoint = bikeCoords[bikeCoords.length - 1];

          const access = routeOnStreetGraph(streetGraph, startPoint, entryPoint);
          const egress = routeOnStreetGraph(streetGraph, exitPoint, endPoint);

          if (access && egress) {
            const bikeKm = computePathDistance(bikeCoords);
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
  }

  // 3) Choose best route — prefer bike lanes if nearby
  if (!streetRoute && !mixedRoute) return null;

  if (streetRoute && !mixedRoute) {
    return {
      accessCoords: streetRoute.coords,
      bikeCoords: [],
      egressCoords: [],
      totalKm: streetRoute.distKm,
      bikeKm: 0,
      bikeLanePercent: 0,
      estimatedTimeMin: Math.round((streetRoute.distKm / AVG_CYCLING_SPEED_KMH) * 60),
    };
  }

  if (!streetRoute && mixedRoute) {
    return {
      accessCoords: mixedRoute.coordsAccess,
      bikeCoords: mixedRoute.coordsBike,
      egressCoords: mixedRoute.coordsEgress,
      totalKm: mixedRoute.totalKm,
      bikeKm: mixedRoute.bikeKm,
      bikeLanePercent: Math.round((mixedRoute.bikeKm / mixedRoute.totalKm) * 100),
      estimatedTimeMin: Math.round((mixedRoute.totalKm / AVG_CYCLING_SPEED_KMH) * 60),
    };
  }

  // Both exist: prefer mixed if it has bike portion and isn't too much longer
  // Allow mixed route up to 80% longer than street-only to prioritize bike lanes
  const streetDist = streetRoute!.distKm;
  const mixedDist = mixedRoute!.totalKm;
  const tolerance = Math.max(streetDist * 0.8, 0.5); // at least 500m or 80%

  if (
    mixedRoute!.bikeKm > 0.05 &&
    mixedDist <= streetDist + tolerance
  ) {
    return {
      accessCoords: mixedRoute!.coordsAccess,
      bikeCoords: mixedRoute!.coordsBike,
      egressCoords: mixedRoute!.coordsEgress,
      totalKm: mixedRoute!.totalKm,
      bikeKm: mixedRoute!.bikeKm,
      bikeLanePercent: Math.round((mixedRoute!.bikeKm / mixedRoute!.totalKm) * 100),
      estimatedTimeMin: Math.round((mixedRoute!.totalKm / AVG_CYCLING_SPEED_KMH) * 60),
    };
  }

  // Mixed route is too long, fall back to street
  return {
    accessCoords: streetRoute!.coords,
    bikeCoords: [],
    egressCoords: [],
    totalKm: streetRoute!.distKm,
    bikeKm: 0,
    bikeLanePercent: 0,
    estimatedTimeMin: Math.round((streetRoute!.distKm / AVG_CYCLING_SPEED_KMH) * 60),
  };
}
