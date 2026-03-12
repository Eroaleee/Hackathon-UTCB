/**
 * Bike Routing Service — A* on OSM road network, prioritizing bike lanes.
 *
 * 1. Builds bidirectional graph from RoadSegment + RoadNode DB tables
 * 2. Snaps start/end to nearest nodes
 * 3. Runs A* with a cost function that heavily favours bike_lane & pedestrian,
 *    penalises car_only, and uses haversine heuristic
 * 4. Returns typed/colored segments with real street geometry
 */
import prisma from "../prisma";

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------
interface RouteRequest {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
}

interface RouteSegmentInfo {
  name: string;
  roadType: string;
  safetyScore: number;
  length: number; // meters
  coordinates: number[][]; // [[lng, lat], ...]
}

interface SafeSpot {
  lat: number;
  lng: number;
  name: string;
  type: "park" | "low_traffic" | "bike_parking" | "pedestrian_zone";
}

interface PointOfInterest {
  lat: number;
  lng: number;
  name: string;
  type: "semafor" | "parcare_biciclete";
}

interface RouteResult {
  found: boolean;
  totalDistanceM: number;
  totalTimeMin: number;
  safetyAvg: number;
  bikeLanePercent: number;
  segments: RouteSegmentInfo[];
  safeSpots: SafeSpot[];
  pointsOfInterest: PointOfInterest[];
  geojson: {
    type: "FeatureCollection";
    features: {
      type: "Feature";
      geometry: { type: "LineString"; coordinates: number[][] };
      properties: {
        roadType: string;
        safetyScore: number;
        name: string;
        segmentIndex: number;
      };
    }[];
  };
}

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ------------------------------------------------------------------
// Cost multipliers — lower = preferred
// ------------------------------------------------------------------
function costMultiplier(roadType: string): number {
  switch (roadType) {
    case "bike_lane":   return 0.5;   // strongly preferred
    case "pedestrian":  return 0.7;   // good
    case "shared":      return 1.2;   // acceptable
    case "car_only":    return 3.0;   // heavy penalty
    default:            return 2.0;
  }
}

// Average cycling speed by road type for time estimation (km/h)
function bikeSpeed(roadType: string): number {
  switch (roadType) {
    case "bike_lane":   return 18;
    case "pedestrian":  return 12;
    case "shared":      return 14;
    case "car_only":    return 15;
    default:            return 14;
  }
}

// ------------------------------------------------------------------
// Graph structures
// ------------------------------------------------------------------
interface GraphEdge {
  toNode: string;
  segId: string;
  length: number;
  cost: number;       // length * costMultiplier
  roadType: string;
  safetyScore: number;
  name: string;
  geometry: number[][]; // [[lng,lat],...]
  reversed: boolean;    // true if traversed toNode→fromNode
}

interface GraphNode {
  lat: number;
  lng: number;
  edges: GraphEdge[];
}

// ------------------------------------------------------------------
// A* implementation with min-heap
// ------------------------------------------------------------------
class MinHeap {
  private data: { node: string; f: number }[] = [];

  push(node: string, f: number) {
    this.data.push({ node, f });
    this._bubbleUp(this.data.length - 1);
  }
  pop(): string | undefined {
    if (this.data.length === 0) return undefined;
    const top = this.data[0].node;
    const last = this.data.pop()!;
    if (this.data.length > 0) {
      this.data[0] = last;
      this._sinkDown(0);
    }
    return top;
  }
  get size() { return this.data.length; }

  private _bubbleUp(i: number) {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.data[i].f >= this.data[parent].f) break;
      [this.data[i], this.data[parent]] = [this.data[parent], this.data[i]];
      i = parent;
    }
  }
  private _sinkDown(i: number) {
    const n = this.data.length;
    while (true) {
      let smallest = i;
      const l = 2 * i + 1, r = 2 * i + 2;
      if (l < n && this.data[l].f < this.data[smallest].f) smallest = l;
      if (r < n && this.data[r].f < this.data[smallest].f) smallest = r;
      if (smallest === i) break;
      [this.data[i], this.data[smallest]] = [this.data[smallest], this.data[i]];
      i = smallest;
    }
  }
}

function astar(
  graph: Map<string, GraphNode>,
  startId: string,
  endId: string,
): GraphEdge[] | null {
  const endNode = graph.get(endId);
  if (!endNode) return null;

  const gScore = new Map<string, number>();
  const cameFrom = new Map<string, { node: string; edge: GraphEdge }>();
  const closed = new Set<string>();

  gScore.set(startId, 0);
  const heap = new MinHeap();
  const startNode = graph.get(startId)!;
  const hStart = haversine(startNode.lat, startNode.lng, endNode.lat, endNode.lng) * 0.5;
  heap.push(startId, hStart);

  while (heap.size > 0) {
    const current = heap.pop()!;
    if (current === endId) {
      // Reconstruct path
      const path: GraphEdge[] = [];
      let c = endId;
      while (cameFrom.has(c)) {
        const { node, edge } = cameFrom.get(c)!;
        path.push(edge);
        c = node;
      }
      path.reverse();
      return path;
    }

    if (closed.has(current)) continue;
    closed.add(current);

    const node = graph.get(current);
    if (!node) continue;
    const g = gScore.get(current)!;

    for (const edge of node.edges) {
      if (closed.has(edge.toNode)) continue;
      const tentG = g + edge.cost;
      if (tentG < (gScore.get(edge.toNode) ?? Infinity)) {
        gScore.set(edge.toNode, tentG);
        cameFrom.set(edge.toNode, { node: current, edge });
        const neighbor = graph.get(edge.toNode);
        if (neighbor) {
          const h = haversine(neighbor.lat, neighbor.lng, endNode.lat, endNode.lng) * 0.5;
          heap.push(edge.toNode, tentG + h);
        }
      }
    }
  }
  return null; // no path found
}

// ------------------------------------------------------------------
// Main routing function
// ------------------------------------------------------------------

export async function planRoute(req: RouteRequest): Promise<RouteResult> {
  const { startLat, startLng, endLat, endLng } = req;

  // 1. Load road network from DB
  const [segments, nodes] = await Promise.all([
    prisma.roadSegment.findMany(),
    prisma.roadNode.findMany(),
  ]);

  // 2. Build bidirectional graph
  const graph = new Map<string, GraphNode>();

  for (const n of nodes) {
    graph.set(n.id, { lat: n.latitude, lng: n.longitude, edges: [] });
  }

  for (const seg of segments) {
    const fromNode = graph.get(seg.fromNodeId);
    const toNode = graph.get(seg.toNodeId);
    if (!fromNode || !toNode) continue;

    const geom = (seg.geometry as any)?.coordinates as number[][] | undefined;
    const coords = geom && geom.length >= 2 ? geom : [
      [fromNode.lng, fromNode.lat],
      [toNode.lng, toNode.lat],
    ];

    const cost = seg.length * costMultiplier(seg.roadType);

    // Forward edge
    fromNode.edges.push({
      toNode: seg.toNodeId,
      segId: seg.id,
      length: seg.length,
      cost,
      roadType: seg.roadType,
      safetyScore: seg.safetyScore,
      name: seg.name,
      geometry: coords,
      reversed: false,
    });

    // Reverse edge (bidirectional — bike lanes can be ridden both ways)
    toNode.edges.push({
      toNode: seg.fromNodeId,
      segId: seg.id,
      length: seg.length,
      cost,
      roadType: seg.roadType,
      safetyScore: seg.safetyScore,
      name: seg.name,
      geometry: [...coords].reverse(),
      reversed: true,
    });
  }

  // 3. Snap start/end to nearest nodes
  const startNodeId = findNearestNode(nodes, startLat, startLng);
  const endNodeId = findNearestNode(nodes, endLat, endLng);
  if (!startNodeId || !endNodeId) return emptyResult();
  if (startNodeId === endNodeId) return emptyResult();

  // 4. Run A*
  const path = astar(graph, startNodeId, endNodeId);
  if (!path || path.length === 0) {
    // Fallback: try OSRM if A* can't connect
    return fallbackOSRM(req, segments, nodes);
  }

  // 5. Build result from path
  const routeSegments: RouteSegmentInfo[] = [];
  let totalDistance = 0;
  let bikeLaneDistance = 0;
  let weightedSafety = 0;
  let totalTimeSeconds = 0;

  // Merge consecutive edges with same roadType into single segments
  let currentGroup: GraphEdge[] = [];

  for (let i = 0; i <= path.length; i++) {
    const edge = i < path.length ? path[i] : null;
    if (edge && currentGroup.length > 0 && edge.roadType === currentGroup[0].roadType && edge.name === currentGroup[0].name) {
      currentGroup.push(edge);
    } else {
      if (currentGroup.length > 0) {
        // Flush group
        const mergedCoords: number[][] = [];
        let mergedLen = 0;
        let safetySum = 0;
        for (const e of currentGroup) {
          const c = e.geometry;
          if (mergedCoords.length > 0) {
            // Skip first point to avoid duplicates at junctions
            for (let j = 1; j < c.length; j++) mergedCoords.push(c[j]);
          } else {
            for (const p of c) mergedCoords.push(p);
          }
          mergedLen += e.length;
          safetySum += e.safetyScore * e.length;
        }
        const safety = mergedLen > 0 ? Math.round((safetySum / mergedLen) * 10) / 10 : 0;
        const rt = currentGroup[0].roadType;
        const speed = bikeSpeed(rt);
        totalTimeSeconds += (mergedLen / 1000) / speed * 3600;

        routeSegments.push({
          name: currentGroup[0].name || "Drum",
          roadType: rt,
          safetyScore: safety,
          length: Math.round(mergedLen),
          coordinates: mergedCoords,
        });

        totalDistance += mergedLen;
        weightedSafety += safetySum;
        if (rt === "bike_lane" || rt === "pedestrian") bikeLaneDistance += mergedLen;
      }

      currentGroup = edge ? [edge] : [];
    }
  }

  const safetyAvg = totalDistance > 0 ? Math.round((weightedSafety / totalDistance) * 10) / 10 : 0;
  const bikeLanePercent = totalDistance > 0 ? Math.round((bikeLaneDistance / totalDistance) * 100) : 0;
  const totalTimeMin = Math.round((totalTimeSeconds / 60) * 10) / 10;

  // 6. Find safe spots near dangerous segments
  const dangerousCoords: number[][] = [];
  for (const seg of routeSegments) {
    if (seg.roadType === "car_only" || seg.safetyScore < 50) {
      for (const c of seg.coordinates) dangerousCoords.push(c);
    }
  }
  const safeSpots = await findSafeSpots(dangerousCoords);

  // 6b. Find POIs (semafoare, bike parking) along full route
  const allRouteCoords: number[][] = [];
  for (const seg of routeSegments) {
    for (const c of seg.coordinates) allRouteCoords.push(c);
  }
  const pointsOfInterest = await findPOIsAlongRoute(allRouteCoords);

  // 7. Build GeoJSON
  const features = routeSegments.map((seg, idx) => ({
    type: "Feature" as const,
    geometry: { type: "LineString" as const, coordinates: seg.coordinates },
    properties: {
      roadType: seg.roadType,
      safetyScore: seg.safetyScore,
      name: seg.name,
      segmentIndex: idx,
    },
  }));

  return {
    found: true,
    totalDistanceM: Math.round(totalDistance),
    totalTimeMin,
    safetyAvg,
    bikeLanePercent,
    segments: routeSegments,
    safeSpots,
    pointsOfInterest,
    geojson: { type: "FeatureCollection", features },
  };
}

// ------------------------------------------------------------------
// Find nearest graph node to a coordinate
// ------------------------------------------------------------------
function findNearestNode(
  nodes: { id: string; latitude: number; longitude: number }[],
  lat: number, lng: number
): string | null {
  let bestId: string | null = null;
  let bestDist = Infinity;
  for (const n of nodes) {
    const d = haversine(lat, lng, n.latitude, n.longitude);
    if (d < bestDist) { bestDist = d; bestId = n.id; }
  }
  // Only snap if within 1km
  return bestDist < 1000 ? bestId : null;
}

// ------------------------------------------------------------------
// OSRM fallback — used only when A* can't find a path
// ------------------------------------------------------------------

interface OSRMStep {
  geometry: { type: "LineString"; coordinates: number[][] };
  distance: number;
  name: string;
}

interface DBSegment {
  name: string;
  roadType: string;
  safetyScore: number;
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
}

function pointToSegmentDist(
  pLat: number, pLng: number,
  aLat: number, aLng: number,
  bLat: number, bLng: number,
): number {
  const dx = bLng - aLng, dy = bLat - aLat;
  if (dx === 0 && dy === 0) return haversine(pLat, pLng, aLat, aLng);
  let t = ((pLng - aLng) * dx + (pLat - aLat) * dy) / (dx * dx + dy * dy);
  t = Math.max(0, Math.min(1, t));
  return haversine(pLat, pLng, aLat + t * dy, aLng + t * dx);
}

function classifyPoint(lat: number, lng: number, dbSegs: DBSegment[]): { roadType: string; safetyScore: number; name: string } {
  let best: DBSegment | null = null;
  let bestDist = Infinity;
  for (const seg of dbSegs) {
    const d = pointToSegmentDist(lat, lng, seg.fromLat, seg.fromLng, seg.toLat, seg.toLng);
    if (d < bestDist) { bestDist = d; best = seg; }
  }
  if (best && bestDist < 300) {
    return { roadType: best.roadType, safetyScore: best.safetyScore, name: best.name };
  }
  return { roadType: "car_only", safetyScore: 30, name: "Drum auto" };
}

async function fallbackOSRM(
  req: RouteRequest,
  segments: any[],
  nodes: any[],
): Promise<RouteResult> {
  const { startLat, startLng, endLat, endLng } = req;
  const url = `https://router.project-osrm.org/route/v1/bike/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson&steps=true`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return emptyResult();
    const data: any = await res.json();
    if (data.code !== "Ok" || !data.routes?.length) return emptyResult();
    const route = data.routes[0];
    const steps: OSRMStep[] = route.legs?.[0]?.steps || [];

    const nodeMap = new Map<string, { lat: number; lng: number }>();
    for (const n of nodes) nodeMap.set(n.id, { lat: n.latitude, lng: n.longitude });
    const dbSegs: DBSegment[] = segments.map((s: any) => {
      const from = nodeMap.get(s.fromNodeId);
      const to = nodeMap.get(s.toNodeId);
      return {
        name: s.name, roadType: s.roadType, safetyScore: s.safetyScore,
        fromLat: from?.lat ?? 0, fromLng: from?.lng ?? 0,
        toLat: to?.lat ?? 0, toLng: to?.lng ?? 0,
      };
    });

    const routeSegments: RouteSegmentInfo[] = [];
    let totalDistance = 0, bikeLaneDistance = 0, weightedSafety = 0;
    for (const step of steps) {
      if (!step.geometry?.coordinates?.length || step.distance < 1) continue;
      const coords = step.geometry.coordinates;
      const midIdx = Math.floor(coords.length / 2);
      const midCoord = coords[midIdx] || coords[0];
      const classification = classifyPoint(midCoord[1], midCoord[0], dbSegs);
      const segLen = step.distance;
      totalDistance += segLen;
      weightedSafety += classification.safetyScore * segLen;
      if (classification.roadType === "bike_lane" || classification.roadType === "pedestrian") bikeLaneDistance += segLen;
      routeSegments.push({
        name: step.name || classification.name,
        roadType: classification.roadType,
        safetyScore: classification.safetyScore,
        length: Math.round(segLen),
        coordinates: coords,
      });
    }

    const safetyAvg = totalDistance > 0 ? Math.round((weightedSafety / totalDistance) * 10) / 10 : 0;
    const bikeLanePercent = totalDistance > 0 ? Math.round((bikeLaneDistance / totalDistance) * 100) : 0;
    const totalTimeMin = Math.round(((route.duration || 0) / 60) * 10) / 10;

    const dangerousCoords: number[][] = [];
    for (const seg of routeSegments) {
      if (seg.roadType === "car_only" || seg.safetyScore < 50) {
        for (const c of seg.coordinates) dangerousCoords.push(c);
      }
    }
    const safeSpots = await findSafeSpots(dangerousCoords);
    const allRouteCoords: number[][] = [];
    for (const seg of routeSegments) {
      for (const c of seg.coordinates) allRouteCoords.push(c);
    }
    const pointsOfInterest = await findPOIsAlongRoute(allRouteCoords);
    const features = routeSegments.map((seg, idx) => ({
      type: "Feature" as const,
      geometry: { type: "LineString" as const, coordinates: seg.coordinates },
      properties: { roadType: seg.roadType, safetyScore: seg.safetyScore, name: seg.name, segmentIndex: idx },
    }));

    return {
      found: true, totalDistanceM: Math.round(totalDistance), totalTimeMin,
      safetyAvg, bikeLanePercent, segments: routeSegments, safeSpots,
      pointsOfInterest,
      geojson: { type: "FeatureCollection", features },
    };
  } catch {
    return emptyResult();
  }
}

// ------------------------------------------------------------------
// Safe spot detection
// ------------------------------------------------------------------

async function findSafeSpots(dangerousCoords: number[][]): Promise<SafeSpot[]> {
  if (dangerousCoords.length === 0) return [];
  const spots: SafeSpot[] = [];
  const seen = new Set<string>();

  const infraElements = await prisma.infrastructureElement.findMany({
    where: { type: { in: ["parcare_biciclete", "zona_pietonala", "zona_30"] } },
  });

  const step = Math.max(1, Math.floor(dangerousCoords.length / 10));
  for (let i = 0; i < dangerousCoords.length; i += step) {
    const [lng, lat] = dangerousCoords[i];

    for (const el of infraElements) {
      const g = el.geometry as { coordinates?: number[] } | null;
      if (!g?.coordinates || g.coordinates.length < 2) continue;
      const d = haversine(lat, lng, g.coordinates[1], g.coordinates[0]);
      if (d < 400) {
        const key = `${g.coordinates[1].toFixed(4)},${g.coordinates[0].toFixed(4)}`;
        if (!seen.has(key)) {
          seen.add(key);
          const spotType =
            el.type === "parcare_biciclete" ? ("bike_parking" as const) :
            el.type === "zona_pietonala" ? ("pedestrian_zone" as const) :
            ("low_traffic" as const);
          spots.push({ lat: g.coordinates[1], lng: g.coordinates[0], name: el.name, type: spotType });
        }
      }
    }
  }

  return spots;
}

// ------------------------------------------------------------------
// POI detection (semafoare + bike parking along route)
// ------------------------------------------------------------------

async function findPOIsAlongRoute(routeCoords: number[][]): Promise<PointOfInterest[]> {
  if (routeCoords.length === 0) return [];

  const infraElements = await prisma.infrastructureElement.findMany({
    where: { type: { in: ["semafor", "parcare_biciclete"] } },
  });

  const pois: PointOfInterest[] = [];
  const seen = new Set<string>();

  // Sample route coords to keep it fast
  const step = Math.max(1, Math.floor(routeCoords.length / 20));
  for (let i = 0; i < routeCoords.length; i += step) {
    const [lng, lat] = routeCoords[i];

    for (const el of infraElements) {
      const g = el.geometry as { type?: string; coordinates?: number[] } | null;
      if (!g?.coordinates || g.coordinates.length < 2) continue;
      const d = haversine(lat, lng, g.coordinates[1], g.coordinates[0]);
      if (d < 200) { // 200m radius
        const key = el.id;
        if (!seen.has(key)) {
          seen.add(key);
          pois.push({
            lat: g.coordinates[1],
            lng: g.coordinates[0],
            name: el.name,
            type: el.type as "semafor" | "parcare_biciclete",
          });
        }
      }
    }
  }

  return pois;
}

// ------------------------------------------------------------------
// Utilities
// ------------------------------------------------------------------

function emptyResult(): RouteResult {
  return {
    found: false,
    totalDistanceM: 0,
    totalTimeMin: 0,
    safetyAvg: 0,
    bikeLanePercent: 0,
    segments: [],
    safeSpots: [],
    pointsOfInterest: [],
    geojson: { type: "FeatureCollection", features: [] },
  };
}
