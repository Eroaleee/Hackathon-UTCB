/**
 * Simulation Engine — Graph-based multi-factor scoring for cycling infrastructure.
 * 
 * Analyzes the road network graph and computes:
 * 1. Network Connectivity Score - connected components & shortest paths
 * 2. Safety Score - per-segment risk aggregated
 * 3. Coverage Score - population within 300m of bike lanes
 * 4. Conflict Zone Detection - unsignaled high-traffic crossings
 * 5. Accessibility Score - transit stops with bike parking nearby
 */
import prisma from "../prisma";

interface SimulationResult {
  safetyScore: number;
  coveragePercent: number;
  conflictZones: number;
  accessibilityScore: number;
  details: {
    totalBikeLaneKm: number;
    connectedComponents: number;
    avgSafetyPerSegment: number;
    transitStopsWithBikeAccess: number;
    totalTransitStops: number;
    conflictZoneLocations: { lat: number; lng: number; reason: string }[];
    segmentScores: { name: string; safety: number; type: string; length: number }[];
  };
}

interface GeoJSONFeature {
  type: "Feature";
  geometry: {
    type: string;
    coordinates: number[][] | number[];
  };
  properties: Record<string, unknown>;
}

interface GeoJSONFeatureCollection {
  type: "FeatureCollection";
  features: GeoJSONFeature[];
}

/**
 * Run a simulation with optional proposed changes applied on top of current infrastructure.
 */
type RoadSeg = Awaited<ReturnType<typeof prisma.roadSegment.findMany>>[number];

export async function runSimulation(changes?: GeoJSONFeatureCollection | null): Promise<SimulationResult> {
  // 1. Load current road network
  const segments = await prisma.roadSegment.findMany();
  const nodes = await prisma.roadNode.findMany();
  const transitStops = await prisma.transitStop.findMany();
  const infraElements = await prisma.infrastructureElement.findMany();
  const unresolvedReports = await prisma.report.findMany({
    where: { status: { in: ["trimis", "in_analiza"] }, severity: { in: ["ridicat", "critic"] } },
  });

  // Build adjacency list
  const adjacency = new Map<string, { to: string; segment: typeof segments[0] }[]>();
  for (const seg of segments) {
    if (!adjacency.has(seg.fromNodeId)) adjacency.set(seg.fromNodeId, []);
    if (!adjacency.has(seg.toNodeId)) adjacency.set(seg.toNodeId, []);
    adjacency.get(seg.fromNodeId)!.push({ to: seg.toNodeId, segment: seg });
    adjacency.get(seg.toNodeId)!.push({ to: seg.fromNodeId, segment: seg });
  }

  // Apply proposed changes: add new bike lane segments
  const virtualSegments: RoadSeg[] = [...segments];
  if (changes?.features) {
    for (const feature of changes.features) {
      if (feature.geometry.type === "LineString") {
        const coords = feature.geometry.coordinates as number[][];
        for (let i = 0; i < coords.length - 1; i++) {
          const [lng1, lat1] = coords[i];
          const [lng2, lat2] = coords[i + 1];
          const length = haversine(lat1, lng1, lat2, lng2);
          virtualSegments.push({
            id: `virtual_${i}_${Math.random().toString(36).slice(2, 8)}`,
            fromNodeId: `v_${lat1}_${lng1}`,
            toNodeId: `v_${lat2}_${lng2}`,
            name: (feature.properties?.name as string) || "Pistă propusă",
            length,
            roadType: "bike_lane",
            speedLimit: 30,
            trafficLoad: 0.2,
            safetyScore: 75,
            geometry: { type: "LineString", coordinates: [coords[i], coords[i + 1]] },
          } as typeof segments[0]);
        }
      }
    }
  }

  // 2. Compute metrics

  // -- Bike lane total km
  const bikeLaneSegments = virtualSegments.filter((s) => s.roadType === "bike_lane" || s.roadType === "pedestrian");
  const totalBikeLaneKm = bikeLaneSegments.reduce((sum, s) => sum + s.length, 0) / 1000;

  // -- Connected components (bike-lane subgraph via Union-Find)
  const bikeAdj = new Map<string, Set<string>>();
  for (const seg of bikeLaneSegments) {
    if (!bikeAdj.has(seg.fromNodeId)) bikeAdj.set(seg.fromNodeId, new Set());
    if (!bikeAdj.has(seg.toNodeId)) bikeAdj.set(seg.toNodeId, new Set());
    bikeAdj.get(seg.fromNodeId)!.add(seg.toNodeId);
    bikeAdj.get(seg.toNodeId)!.add(seg.fromNodeId);
  }
  const visited = new Set<string>();
  let connectedComponents = 0;
  for (const nodeId of bikeAdj.keys()) {
    if (visited.has(nodeId)) continue;
    connectedComponents++;
    const stack = [nodeId];
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (visited.has(current)) continue;
      visited.add(current);
      for (const neighbor of bikeAdj.get(current) || []) {
        if (!visited.has(neighbor)) stack.push(neighbor);
      }
    }
  }

  // -- Safety Score: weighted average of segment safety scores  
  const totalLength = virtualSegments.reduce((sum, s) => sum + s.length, 0);
  const weightedSafety = virtualSegments.reduce((sum, s) => sum + s.safetyScore * s.length, 0);
  const avgSafety = totalLength > 0 ? weightedSafety / totalLength : 0;
  
  // Bonus for fewer connected components (more connected = better)
  const connectivityBonus = connectedComponents <= 1 ? 15 : connectedComponents <= 3 ? 8 : 0;
  // Penalty for unresolved reports
  const reportPenalty = Math.min(unresolvedReports.length * 0.5, 20);
  const safetyScore = Math.round(Math.min(Math.max(avgSafety + connectivityBonus - reportPenalty, 0), 100));

  // -- Coverage Score: % of transit stops within 300m of a bike lane
  const COVERAGE_RADIUS = 300; // meters
  let coveredStops = 0;
  for (const stop of transitStops) {
    const isCovered = bikeLaneSegments.some((seg) => {
      const geom = seg.geometry as { coordinates: number[][] } | null;
      if (!geom?.coordinates) return false;
      return geom.coordinates.some(([lng, lat]) => haversine(stop.latitude, stop.longitude, lat, lng) <= COVERAGE_RADIUS);
    });
    // Also check infrastructure elements (bike parking, etc.)
    const nearInfra = infraElements.some((el) => {
      const g = el.geometry as { coordinates?: number[] } | null;
      if (!g?.coordinates) return false;
      return haversine(stop.latitude, stop.longitude, g.coordinates[1], g.coordinates[0]) <= COVERAGE_RADIUS;
    });
    if (isCovered || nearInfra) coveredStops++;
  }
  const coveragePercent = transitStops.length > 0 ? Math.round((coveredStops / transitStops.length) * 100) : 0;

  // -- Conflict Zones: high-traffic intersections without bike infrastructure
  const conflictZoneLocations: { lat: number; lng: number; reason: string }[] = [];
  // Find nodes where car-only roads meet bike lanes without traffic signals
  const nodeCoords = new Map<string, { lat: number; lng: number }>(nodes.map((n) => [n.id, { lat: n.latitude, lng: n.longitude }]));
  const signalElements = infraElements.filter((e) => e.type === "semafor");

  for (const [nodeId, neighbors] of adjacency) {
    const hasCarOnly = neighbors.some((n) => n.segment.roadType === "car_only" && n.segment.trafficLoad > 0.3);
    const hasBikeLane = neighbors.some((n) => n.segment.roadType === "bike_lane");
    if (hasCarOnly && hasBikeLane) {
      const coords = nodeCoords.get(nodeId);
      if (!coords) continue;
      // Check if there's a traffic signal nearby
      const hasSignal = signalElements.some((s) => {
        const g = s.geometry as { coordinates?: number[] } | null;
        if (!g?.coordinates) return false;
        return haversine(coords.lat, coords.lng, g.coordinates[1], g.coordinates[0]) < 100;
      });
      if (!hasSignal) {
        conflictZoneLocations.push({ lat: coords.lat, lng: coords.lng, reason: "Intersecție neasigurată" });
      }
    }
  }
  // Also add clusters of high-severity reports
  const reportClusters = clusterPoints(
    unresolvedReports.map((r) => ({ lat: r.latitude, lng: r.longitude })),
    200
  );
  for (const cluster of reportClusters) {
    if (cluster.count >= 3) {
      conflictZoneLocations.push({ lat: cluster.lat, lng: cluster.lng, reason: `Cluster: ${cluster.count} rapoarte nerezolvate` });
    }
  }

  // -- Accessibility Score: transit stops with bike parking within 200m
  const ACCESSIBILITY_RADIUS = 200;
  const bikeParkingElements = infraElements.filter((e) => e.type === "parcare_biciclete");
  let accessibleStops = 0;
  for (const stop of transitStops) {
    const hasBikeParking = bikeParkingElements.some((bp) => {
      const g = bp.geometry as { coordinates?: number[] } | null;
      if (!g?.coordinates) return false;
      return haversine(stop.latitude, stop.longitude, g.coordinates[1], g.coordinates[0]) <= ACCESSIBILITY_RADIUS;
    });
    const nearBikeLane = bikeLaneSegments.some((seg) => {
      const geom = seg.geometry as { coordinates: number[][] } | null;
      if (!geom?.coordinates) return false;
      return geom.coordinates.some(([lng, lat]) => haversine(stop.latitude, stop.longitude, lat, lng) <= ACCESSIBILITY_RADIUS);
    });
    if (hasBikeParking || nearBikeLane) accessibleStops++;
  }
  const accessibilityScore = transitStops.length > 0 ? Math.round((accessibleStops / transitStops.length) * 100) : 0;

  const segmentScores = virtualSegments.map((s) => ({
    name: s.name,
    safety: s.safetyScore,
    type: s.roadType,
    length: Math.round(s.length),
  }));

  return {
    safetyScore,
    coveragePercent,
    conflictZones: conflictZoneLocations.length,
    accessibilityScore,
    details: {
      totalBikeLaneKm: Math.round(totalBikeLaneKm * 10) / 10,
      connectedComponents,
      avgSafetyPerSegment: Math.round(avgSafety * 10) / 10,
      transitStopsWithBikeAccess: coveredStops,
      totalTransitStops: transitStops.length,
      conflictZoneLocations,
      segmentScores,
    },
  };
}

/**
 * Haversine distance in meters between two lat/lng points.
 */
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Simple point clustering for conflict zone detection.
 */
function clusterPoints(points: { lat: number; lng: number }[], radiusMeters: number): { lat: number; lng: number; count: number }[] {
  const clusters: { lat: number; lng: number; count: number; sumLat: number; sumLng: number }[] = [];
  for (const p of points) {
    const existing = clusters.find((c) => haversine(c.lat, c.lng, p.lat, p.lng) <= radiusMeters);
    if (existing) {
      existing.count++;
      existing.sumLat += p.lat;
      existing.sumLng += p.lng;
      existing.lat = existing.sumLat / existing.count;
      existing.lng = existing.sumLng / existing.count;
    } else {
      clusters.push({ lat: p.lat, lng: p.lng, count: 1, sumLat: p.lat, sumLng: p.lng });
    }
  }
  return clusters.map(({ lat, lng, count }) => ({ lat, lng, count }));
}
