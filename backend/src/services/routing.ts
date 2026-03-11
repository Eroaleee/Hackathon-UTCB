/**
 * Bike Routing Service — Dijkstra-based route planner for the Sector 2 road network.
 *
 * Computes the best cycling route between two coordinate points using the
 * RoadSegment graph. Prefers bike lanes, penalises car-only roads, and
 * identifies "safe spots" (parks, low-traffic streets, bike parking) along
 * stretches that have no dedicated bike infrastructure.
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

interface RouteResult {
  found: boolean;
  totalDistanceM: number;
  totalTimeMin: number;
  safetyAvg: number;
  bikeLanePercent: number;
  segments: RouteSegmentInfo[];
  safeSpots: SafeSpot[];
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

/**
 * Cost function for a road segment.
 * Lower cost = preferred.  bike_lane < pedestrian < shared <<< car_only
 */
function edgeCost(length: number, roadType: string, safetyScore: number): number {
  const typeMultiplier: Record<string, number> = {
    bike_lane: 1.0,
    pedestrian: 1.2,
    shared: 1.8,
    car_only: 4.0,
  };
  const mult = typeMultiplier[roadType] ?? 3.0;
  // Safety inversely affects cost: lower safety → higher cost
  const safetyPenalty = 1 + (100 - safetyScore) / 100;
  return length * mult * safetyPenalty;
}

// ------------------------------------------------------------------
// Main routing function
// ------------------------------------------------------------------

export async function planRoute(req: RouteRequest): Promise<RouteResult> {
  const { startLat, startLng, endLat, endLng } = req;

  // 1. Load entire road network
  const segments = await prisma.roadSegment.findMany();
  const nodes = await prisma.roadNode.findMany();

  if (nodes.length === 0 || segments.length === 0) {
    return emptyResult();
  }

  // Map nodeId → { lat, lng }
  const nodeCoord = new Map<string, { lat: number; lng: number }>();
  for (const n of nodes) nodeCoord.set(n.id, { lat: n.latitude, lng: n.longitude });

  // 2. Find closest graph nodes to start / end coordinates
  const startNodeId = closestNode(startLat, startLng, nodes);
  const endNodeId = closestNode(endLat, endLng, nodes);

  if (!startNodeId || !endNodeId || startNodeId === endNodeId) {
    return emptyResult();
  }

  // 3. Build adjacency
  const adj = new Map<string, { to: string; seg: typeof segments[0] }[]>();
  for (const seg of segments) {
    if (!adj.has(seg.fromNodeId)) adj.set(seg.fromNodeId, []);
    if (!adj.has(seg.toNodeId)) adj.set(seg.toNodeId, []);
    adj.get(seg.fromNodeId)!.push({ to: seg.toNodeId, seg });
    adj.get(seg.toNodeId)!.push({ to: seg.fromNodeId, seg });
  }

  // 4. Dijkstra with priority queue (binary heap approximation using array)
  const dist = new Map<string, number>();
  const prev = new Map<string, { node: string; seg: typeof segments[0] } | null>();
  dist.set(startNodeId, 0);
  prev.set(startNodeId, null);

  // Simple priority queue (sufficient for <500 nodes)
  const pq: { node: string; cost: number }[] = [{ node: startNodeId, cost: 0 }];
  const visited = new Set<string>();

  while (pq.length > 0) {
    // Extract min
    pq.sort((a, b) => a.cost - b.cost);
    const { node: current, cost: currentCost } = pq.shift()!;

    if (visited.has(current)) continue;
    visited.add(current);

    if (current === endNodeId) break;

    const neighbors = adj.get(current) || [];
    for (const { to, seg } of neighbors) {
      if (visited.has(to)) continue;
      const cost = edgeCost(seg.length, seg.roadType, seg.safetyScore);
      const newDist = currentCost + cost;
      if (!dist.has(to) || newDist < dist.get(to)!) {
        dist.set(to, newDist);
        prev.set(to, { node: current, seg });
        pq.push({ node: to, cost: newDist });
      }
    }
  }

  // 5. Reconstruct path
  if (!prev.has(endNodeId)) {
    return emptyResult();
  }

  const pathSegments: typeof segments[0][] = [];
  let cur: string | undefined = endNodeId;
  while (cur && prev.get(cur)) {
    const entry: { node: string; seg: typeof segments[0] } = prev.get(cur)!;
    pathSegments.unshift(entry.seg);
    cur = entry.node;
  }

  if (pathSegments.length === 0) return emptyResult();

  // 6. Build result
  let totalDistance = 0;
  let bikeLaneDistance = 0;
  let weightedSafety = 0;
  const routeSegments: RouteSegmentInfo[] = [];
  const allCoords: number[][] = [];

  for (const seg of pathSegments) {
    totalDistance += seg.length;
    weightedSafety += seg.safetyScore * seg.length;
    if (seg.roadType === "bike_lane" || seg.roadType === "pedestrian") {
      bikeLaneDistance += seg.length;
    }

    const geom = seg.geometry as { coordinates?: number[][] } | null;
    const coords = geom?.coordinates || [];

    routeSegments.push({
      name: seg.name,
      roadType: seg.roadType,
      safetyScore: seg.safetyScore,
      length: Math.round(seg.length),
      coordinates: coords,
    });

    // Merge coordinates for safe-spot detection
    for (const c of coords) allCoords.push(c);
  }

  const safetyAvg = totalDistance > 0 ? Math.round((weightedSafety / totalDistance) * 10) / 10 : 0;
  const bikeLanePercent = totalDistance > 0 ? Math.round((bikeLaneDistance / totalDistance) * 100) : 0;
  // ~15 km/h average cycling speed
  const totalTimeMin = Math.round((totalDistance / 250) * 10) / 10;

  // 7. Find safe spots near dangerous segments (car_only / low safety)
  const safeSpots = await findSafeSpots(pathSegments, nodeCoord);

  // 8. Build GeoJSON
  const features = routeSegments.map((seg, idx) => ({
    type: "Feature" as const,
    geometry: {
      type: "LineString" as const,
      coordinates: seg.coordinates,
    },
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
    geojson: { type: "FeatureCollection", features },
  };
}

// ------------------------------------------------------------------
// Safe spot detection
// ------------------------------------------------------------------

async function findSafeSpots(
  pathSegments: { roadType: string; safetyScore: number; fromNodeId: string; toNodeId: string; name: string }[],
  nodeCoord: Map<string, { lat: number; lng: number }>
): Promise<SafeSpot[]> {
  const spots: SafeSpot[] = [];
  const seen = new Set<string>(); // dedupe by coordinate key

  // Load relevant data
  const infraElements = await prisma.infrastructureElement.findMany({
    where: { type: { in: ["parcare_biciclete", "zona_pietonala", "zona_30"] } },
  });

  for (const seg of pathSegments) {
    // Only suggest safe spots for dangerous segments
    if (seg.roadType !== "car_only" && seg.safetyScore >= 50) continue;

    const fromCoord = nodeCoord.get(seg.fromNodeId);
    const toCoord = nodeCoord.get(seg.toNodeId);
    if (!fromCoord || !toCoord) continue;

    const midLat = (fromCoord.lat + toCoord.lat) / 2;
    const midLng = (fromCoord.lng + toCoord.lng) / 2;

    // Look for nearby bike parking
    for (const el of infraElements) {
      const g = el.geometry as { coordinates?: number[] } | null;
      if (!g?.coordinates || g.coordinates.length < 2) continue;
      const d = haversine(midLat, midLng, g.coordinates[1], g.coordinates[0]);
      if (d < 400) {
        const key = `${g.coordinates[1].toFixed(4)},${g.coordinates[0].toFixed(4)}`;
        if (!seen.has(key)) {
          seen.add(key);
          const spotType = el.type === "parcare_biciclete" ? "bike_parking" as const :
                           el.type === "zona_pietonala" ? "pedestrian_zone" as const :
                           "low_traffic" as const;
          spots.push({ lat: g.coordinates[1], lng: g.coordinates[0], name: el.name, type: spotType });
        }
      }
    }

    // Suggest the midpoint of a dangerous segment as "look for safe alternative"
    const key = `${midLat.toFixed(4)},${midLng.toFixed(4)}`;
    if (!seen.has(key)) {
      seen.add(key);
      spots.push({
        lat: midLat,
        lng: midLng,
        name: `Atenție – ${seg.name}: drum fără pistă ciclabilă`,
        type: "low_traffic",
      });
    }
  }

  return spots;
}

// ------------------------------------------------------------------
// Utilities
// ------------------------------------------------------------------

function closestNode(lat: number, lng: number, nodes: { id: string; latitude: number; longitude: number }[]): string | null {
  let bestId: string | null = null;
  let bestDist = Infinity;
  for (const n of nodes) {
    const d = haversine(lat, lng, n.latitude, n.longitude);
    if (d < bestDist) {
      bestDist = d;
      bestId = n.id;
    }
  }
  return bestId;
}

function emptyResult(): RouteResult {
  return {
    found: false,
    totalDistanceM: 0,
    totalTimeMin: 0,
    safetyAvg: 0,
    bikeLanePercent: 0,
    segments: [],
    safeSpots: [],
    geojson: { type: "FeatureCollection", features: [] },
  };
}
