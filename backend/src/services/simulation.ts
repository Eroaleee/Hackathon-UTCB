/**
 * Simulation Engine — Geometry-first multi-factor scoring for cycling infrastructure.
 *
 * Works with or without existing road-network data in the DB.
 * Analysis is done per-100 m segments extracted from the proposed geometry.
 *
 * Three core metrics (PMUD methodology):
 *
 * 1. Siguranță (Safety)  — Dedicated infrastructure ratio + conflict analysis
 *    Measures what percentage of proposed km use dedicated bike lanes vs shared roads.
 *    Penalises conflict points where bike lanes cross car-only roads and rewards
 *    nearby traffic calming infrastructure (signals, crossings, zone 30).
 *
 * 2. Acoperire (Coverage) — 100 m grid buffer analysis
 *    Overlays a 100 m × 100 m grid on the study area (Bucharest Sector 2 default).
 *    Counts what % of cells are within 300 m of any bike infrastructure.
 *
 * 3. Accesibilitate (Accessibility) — Connectivity + length + network structure
 *    Graph connectivity of the bike sub-network, directness ratio sampling,
 *    and proximity to transit stops.
 *
 * Composite:
 *    VeloScore = Safety × 0.40 + Coverage × 0.35 + Accessibility × 0.25
 */
import prisma from "../prisma";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface SimulationResult {
  safetyScore: number;
  coveragePercent: number;
  conflictZones: number;
  accessibilityScore: number;
  veloScore: number;
  details: {
    totalBikeLaneKm: number;
    connectedComponents: number;
    avgSafetyPerSegment: number;
    transitStopsWithBikeAccess: number;
    totalTransitStops: number;
    conflictZoneLocations: ConflictZone[];
    segmentScores: { name: string; safety: number; type: string; length: number }[];
    safetyBreakdown: {
      totalConflictPoints: number;
      weightedConflictSum: number;
      bikeLaneKmAnalysed: number;
    };
    coverageBreakdown: {
      gridCellsTotal: number;
      gridCellsCovered: number;
      bufferRadiusM: number;
    };
    accessibilityBreakdown: {
      avgDirectnessRatio: number;
      transitProximityScore: number;
      networkConnectivity: number;
    };
  };
}

interface ConflictZone {
  lat: number;
  lng: number;
  reason: string;
  severity?: number;
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

/* ------------------------------------------------------------------ */
/*  Bucharest Sector 2 study-area defaults                             */
/* ------------------------------------------------------------------ */
// When DB has no nodes, we use a fixed bounding box for Sector 2
const DEFAULT_BBOX = {
  minLat: 44.410,
  maxLat: 44.470,
  minLng: 26.090,
  maxLng: 26.170,
};
// Approximate area: ~5.3 km × 6.6 km → ~35 km²
const STUDY_AREA_KM2 = 35;

/* ------------------------------------------------------------------ */
/*  Main simulation entry point                                        */
/* ------------------------------------------------------------------ */

export async function runSimulation(
  changes?: GeoJSONFeatureCollection | null,
): Promise<SimulationResult> {
  /* ---- 1. Load DB data ------------------------------------------ */
  const [dbSegments, nodes, transitStops, infraElements, unresolvedReports] =
    await Promise.all([
      prisma.roadSegment.findMany(),
      prisma.roadNode.findMany(),
      prisma.transitStop.findMany(),
      prisma.infrastructureElement.findMany(),
      prisma.report.findMany({
        where: {
          status: { in: ["trimis", "in_analiza"] },
          severity: { in: ["ridicat", "critic"] },
        },
      }),
    ]);

  /* ---- 2. Extract all bike-lane coordinates from proposed changes  */
  interface Segment100m {
    lat1: number; lng1: number;
    lat2: number; lng2: number;
    lengthM: number;
    kind: "bike_lane" | "zona_30" | "zona_pietonala" | "point";
    name: string;
  }

  const proposedSegments: Segment100m[] = [];
  const proposedPoints: { lat: number; lng: number; type: string; name: string }[] = [];

  if (changes?.features) {
    for (const feature of changes.features) {
      const kind = inferKind(feature);
      const name = (feature.properties?.name as string) || "Element propus";

      if (feature.geometry.type === "LineString") {
        const coords = feature.geometry.coordinates as number[][];
        for (let i = 0; i < coords.length - 1; i++) {
          const [lng1, lat1] = coords[i];
          const [lng2, lat2] = coords[i + 1];
          const segLen = haversine(lat1, lng1, lat2, lng2);

          // Split into ~100 m sub-segments for granular analysis
          const numSubs = Math.max(1, Math.round(segLen / 100));
          for (let s = 0; s < numSubs; s++) {
            const t1 = s / numSubs;
            const t2 = (s + 1) / numSubs;
            proposedSegments.push({
              lat1: lat1 + (lat2 - lat1) * t1,
              lng1: lng1 + (lng2 - lng1) * t1,
              lat2: lat1 + (lat2 - lat1) * t2,
              lng2: lng1 + (lng2 - lng1) * t2,
              lengthM: segLen / numSubs,
              kind: kind as any,
              name,
            });
          }
        }
      } else if (feature.geometry.type === "Point") {
        const [lng, lat] = feature.geometry.coordinates as number[];
        proposedPoints.push({ lat, lng, type: kind, name });
      }
    }
  }

  /* ---- 3. Also add existing DB bike lanes as segments ----------- */
  const existingBikeSegments: Segment100m[] = [];
  for (const seg of dbSegments) {
    if (seg.roadType !== "bike_lane" && seg.roadType !== "pedestrian") continue;
    const geom = seg.geometry as { coordinates?: number[][] } | null;
    if (!geom?.coordinates || geom.coordinates.length < 2) continue;
    for (let i = 0; i < geom.coordinates.length - 1; i++) {
      const [lng1, lat1] = geom.coordinates[i];
      const [lng2, lat2] = geom.coordinates[i + 1];
      const segLen = haversine(lat1, lng1, lat2, lng2);
      const numSubs = Math.max(1, Math.round(segLen / 100));
      for (let s = 0; s < numSubs; s++) {
        const t1 = s / numSubs;
        const t2 = (s + 1) / numSubs;
        existingBikeSegments.push({
          lat1: lat1 + (lat2 - lat1) * t1,
          lng1: lng1 + (lng2 - lng1) * t1,
          lat2: lat1 + (lat2 - lat1) * t2,
          lng2: lng1 + (lng2 - lng1) * t2,
          lengthM: segLen / numSubs,
          kind: "bike_lane",
          name: seg.name,
        });
      }
    }
  }

  const allBikeSegments = [...existingBikeSegments, ...proposedSegments];
  const proposedBikeSegments = proposedSegments.filter(s => s.kind === "bike_lane");
  const totalExistingKm = existingBikeSegments.reduce((s, seg) => s + seg.lengthM, 0) / 1000;
  const totalProposedKm = proposedSegments.reduce((s, seg) => s + seg.lengthM, 0) / 1000;
  const totalBikeLaneKm = allBikeSegments.reduce((s, seg) => s + seg.lengthM, 0) / 1000;

  /* ---- 4. All bike-lane coordinate points for spatial queries --- */
  const allBikeCoords: { lat: number; lng: number }[] = [];
  for (const seg of allBikeSegments) {
    allBikeCoords.push({ lat: seg.lat1, lng: seg.lng1 });
    allBikeCoords.push({ lat: seg.lat2, lng: seg.lng2 });
  }
  for (const p of proposedPoints) {
    allBikeCoords.push({ lat: p.lat, lng: p.lng });
  }

  /* ---- Infrastructure elements for mitigation checks ------------ */
  const signalElements = infraElements.filter(e => e.type === "semafor");
  const zone30Elements = infraElements.filter(e => e.type === "zona_30");
  const pedestrianZones = infraElements.filter(e => e.type === "zona_pietonala");
  const bikeParkingElements = infraElements.filter(e => e.type === "parcare_biciclete");
  // Also count proposed points that act as infrastructure
  const proposedSignals = proposedPoints.filter(p => p.type === "semafor");
  const proposedZone30 = proposedPoints.filter(p => p.type === "zona_30");
  const proposedPedZone = proposedPoints.filter(p => p.type === "zona_pietonala");
  const proposedParking = proposedPoints.filter(p => p.type === "parcare_biciclete");

  const allSignals = [
    ...signalElements.map(e => {
      const g = e.geometry as { coordinates?: number[] } | null;
      return g?.coordinates ? { lat: g.coordinates[1], lng: g.coordinates[0] } : null;
    }).filter(Boolean) as { lat: number; lng: number }[],
    ...proposedSignals,
  ];
  const allZone30 = [
    ...zone30Elements.map(e => {
      const g = e.geometry as { coordinates?: number[] } | null;
      return g?.coordinates ? { lat: g.coordinates[1], lng: g.coordinates[0] } : null;
    }).filter(Boolean) as { lat: number; lng: number }[],
    ...proposedZone30,
  ];
  const allPedZones = [
    ...pedestrianZones.map(e => {
      const g = e.geometry as { coordinates?: number[] } | null;
      return g?.coordinates ? { lat: g.coordinates[1], lng: g.coordinates[0] } : null;
    }).filter(Boolean) as { lat: number; lng: number }[],
    ...proposedPedZone,
  ];

  /* ================================================================ */
  /*  🔴 SAFETY — Per-100m segment analysis                           */
  /* ================================================================ */
  const conflictZoneLocations: ConflictZone[] = [];
  let totalConflictWeight = 0;
  let totalConflictPoints = 0;

  // Gather car-only DB segments for crossing detection
  const carSegCoords: { lat: number; lng: number; speedLimit: number; trafficLoad: number }[] = [];
  for (const seg of dbSegments) {
    if (seg.roadType !== "car_only" && seg.roadType !== "shared") continue;
    const geom = seg.geometry as { coordinates?: number[][] } | null;
    if (!geom?.coordinates) continue;
    for (const [lng, lat] of geom.coordinates) {
      carSegCoords.push({ lat, lng, speedLimit: seg.speedLimit, trafficLoad: seg.trafficLoad });
    }
  }

  // Analyse each 100 m bike segment for safety
  let safetySum = 0;
  for (const seg of allBikeSegments) {
    const midLat = (seg.lat1 + seg.lat2) / 2;
    const midLng = (seg.lng1 + seg.lng2) / 2;

    // Base safety: dedicated bike lane = 80, zona_30 = 65, zona_pietonala = 70, shared = 40
    let segSafety = seg.kind === "bike_lane" ? 80
      : seg.kind === "zona_30" ? 65
      : seg.kind === "zona_pietonala" ? 70
      : 40;

    // Check for nearby car roads (within 50 m) = potential conflict
    const nearCar = carSegCoords.find(c => haversine(midLat, midLng, c.lat, c.lng) < 50);
    if (nearCar) {
      const severity = nearCar.speedLimit >= 70 ? 8 : nearCar.speedLimit >= 50 ? 5 : 3;
      segSafety -= severity;
      totalConflictPoints++;
      const weight = severity * (1 + nearCar.trafficLoad);
      totalConflictWeight += weight;

      if (severity >= 5) {
        conflictZoneLocations.push({
          lat: midLat, lng: midLng,
          reason: nearCar.speedLimit >= 70
            ? "Proximitate drum cu viteză mare (≥70 km/h)"
            : "Intersecție cu drum principal",
          severity,
        });
      }
    }

    // Bonus: nearby signal → +5, zona_30 → +5, pedestrian zone → +3
    if (allSignals.some(s => haversine(midLat, midLng, s.lat, s.lng) < 150)) segSafety += 5;
    if (allZone30.some(z => haversine(midLat, midLng, z.lat, z.lng) < 200)) segSafety += 5;
    if (allPedZones.some(p => haversine(midLat, midLng, p.lat, p.lng) < 200)) segSafety += 3;

    safetySum += clamp(segSafety, 0, 100) * seg.lengthM;
  }

  // If no bike segments exist, base safety on number of infra points (very low)
  const totalBikeLength = allBikeSegments.reduce((s, seg) => s + seg.lengthM, 0);

  // Report penalty
  const reportPenalty = Math.min(unresolvedReports.length * 0.5, 15);

  let safetyScore: number;
  if (totalBikeLength > 0) {
    safetyScore = Math.round(clamp(safetySum / totalBikeLength - reportPenalty, 0, 100));
  } else {
    // No bike infrastructure at all → very low score, but credits for infra points
    const infraBonus = Math.min(
      (allSignals.length * 2 + allZone30.length * 3 + allPedZones.length * 2),
      20
    );
    safetyScore = Math.round(clamp(5 + infraBonus - reportPenalty, 0, 100));
  }

  /* ================================================================ */
  /*  🟡 COVERAGE — 100 m grid buffer analysis (300 m catchment)      */
  /* ================================================================ */
  const COVERAGE_BUFFER_M = 300;
  const CELL_SIZE_M = 100;

  // Determine bounding box: use DB nodes if available, else default Sector 2
  let minLat = DEFAULT_BBOX.minLat, maxLat = DEFAULT_BBOX.maxLat;
  let minLng = DEFAULT_BBOX.minLng, maxLng = DEFAULT_BBOX.maxLng;

  if (nodes.length > 0) {
    minLat = Infinity; maxLat = -Infinity; minLng = Infinity; maxLng = -Infinity;
    for (const n of nodes) {
      if (n.latitude < minLat) minLat = n.latitude;
      if (n.latitude > maxLat) maxLat = n.latitude;
      if (n.longitude < minLng) minLng = n.longitude;
      if (n.longitude > maxLng) maxLng = n.longitude;
    }
    // Expand to include proposed geometry
    for (const c of allBikeCoords) {
      if (c.lat < minLat) minLat = c.lat;
      if (c.lat > maxLat) maxLat = c.lat;
      if (c.lng < minLng) minLng = c.lng;
      if (c.lng > maxLng) maxLng = c.lng;
    }
  } else {
    // With no DB data, expand bbox to include proposed coords
    for (const c of allBikeCoords) {
      if (c.lat < minLat) minLat = c.lat;
      if (c.lat > maxLat) maxLat = c.lat;
      if (c.lng < minLng) minLng = c.lng;
      if (c.lng > maxLng) maxLng = c.lng;
    }
    // Also include transit stops
    for (const s of transitStops) {
      if (s.latitude < minLat) minLat = s.latitude;
      if (s.latitude > maxLat) maxLat = s.latitude;
      if (s.longitude < minLng) minLng = s.longitude;
      if (s.longitude > maxLng) maxLng = s.longitude;
    }
  }

  // Ensure a minimum study area (at least 2 km × 2 km padding around content)
  const PAD_DEG = 0.01; // ~1.1 km
  if (maxLat - minLat < 0.02) { minLat -= PAD_DEG; maxLat += PAD_DEG; }
  if (maxLng - minLng < 0.02) { minLng -= PAD_DEG; maxLng += PAD_DEG; }

  const latSpanM = haversine(minLat, minLng, maxLat, minLng);
  const lngSpanM = haversine(minLat, minLng, minLat, maxLng);
  const gridRows = Math.max(Math.ceil(latSpanM / CELL_SIZE_M), 1);
  const gridCols = Math.max(Math.ceil(lngSpanM / CELL_SIZE_M), 1);
  const maxGridDim = 80;
  const effectiveRows = Math.min(gridRows, maxGridDim);
  const effectiveCols = Math.min(gridCols, maxGridDim);
  const latStep = (maxLat - minLat) / effectiveRows;
  const lngStep = (maxLng - minLng) / effectiveCols;

  let gridCellsCovered = 0;
  const gridCellsTotal = effectiveRows * effectiveCols;

  // Densify bike lane points along segments for better coverage detection
  const denseCoords: { lat: number; lng: number }[] = [];
  for (const seg of allBikeSegments) {
    const d = seg.lengthM;
    const steps = Math.max(1, Math.ceil(d / 50)); // point every 50 m
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      denseCoords.push({
        lat: seg.lat1 + (seg.lat2 - seg.lat1) * t,
        lng: seg.lng1 + (seg.lng2 - seg.lng1) * t,
      });
    }
  }
  for (const p of proposedPoints) denseCoords.push({ lat: p.lat, lng: p.lng });

  for (let r = 0; r < effectiveRows; r++) {
    const cellLat = minLat + (r + 0.5) * latStep;
    for (let c = 0; c < effectiveCols; c++) {
      const cellLng = minLng + (c + 0.5) * lngStep;
      const covered = denseCoords.some(
        p => haversine(cellLat, cellLng, p.lat, p.lng) <= COVERAGE_BUFFER_M,
      );
      if (covered) gridCellsCovered++;
    }
  }

  const coveragePercent = gridCellsTotal > 0
    ? Math.round((gridCellsCovered / gridCellsTotal) * 100)
    : 0;

  /* ================================================================ */
  /*  🟢 ACCESSIBILITY — Connectivity + directness + transit proximity */
  /* ================================================================ */

  // Build bike sub-graph from 100 m segments
  const bikeAdj = new Map<string, Set<string>>();
  const bikeEdgeWeight = new Map<string, Map<string, number>>();
  const bikeNodeCoords = new Map<string, { lat: number; lng: number }>();

  function nodeKey(lat: number, lng: number): string {
    // Round to ~10 m precision to merge close nodes
    return `${lat.toFixed(4)}_${lng.toFixed(4)}`;
  }

  for (const seg of allBikeSegments) {
    const fromKey = nodeKey(seg.lat1, seg.lng1);
    const toKey = nodeKey(seg.lat2, seg.lng2);
    if (fromKey === toKey) continue;

    bikeNodeCoords.set(fromKey, { lat: seg.lat1, lng: seg.lng1 });
    bikeNodeCoords.set(toKey, { lat: seg.lat2, lng: seg.lng2 });

    if (!bikeAdj.has(fromKey)) bikeAdj.set(fromKey, new Set());
    if (!bikeAdj.has(toKey)) bikeAdj.set(toKey, new Set());
    bikeAdj.get(fromKey)!.add(toKey);
    bikeAdj.get(toKey)!.add(fromKey);

    if (!bikeEdgeWeight.has(fromKey)) bikeEdgeWeight.set(fromKey, new Map());
    if (!bikeEdgeWeight.has(toKey)) bikeEdgeWeight.set(toKey, new Map());
    const ex1 = bikeEdgeWeight.get(fromKey)!.get(toKey);
    if (!ex1 || seg.lengthM < ex1) bikeEdgeWeight.get(fromKey)!.set(toKey, seg.lengthM);
    const ex2 = bikeEdgeWeight.get(toKey)!.get(fromKey);
    if (!ex2 || seg.lengthM < ex2) bikeEdgeWeight.get(toKey)!.set(fromKey, seg.lengthM);
  }

  // --- A) Connected components ---
  const visitedBike = new Set<string>();
  let connectedComponents = 0;
  const componentSizes: number[] = [];
  for (const nodeId of bikeAdj.keys()) {
    if (visitedBike.has(nodeId)) continue;
    connectedComponents++;
    let size = 0;
    const stack = [nodeId];
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (visitedBike.has(current)) continue;
      visitedBike.add(current);
      size++;
      for (const neighbor of bikeAdj.get(current) || []) {
        if (!visitedBike.has(neighbor)) stack.push(neighbor);
      }
    }
    componentSizes.push(size);
  }

  const largestComponent = componentSizes.length > 0 ? Math.max(...componentSizes) : 0;
  const totalBikeNodes = bikeAdj.size;
  const networkConnectivity = totalBikeNodes > 0
    ? (largestComponent / totalBikeNodes) * 100
    : 0;

  // --- B) Directness ratio sampling ---
  const bikeNodeIds = Array.from(bikeAdj.keys());
  let directnessSum = 0;
  let directnessSamples = 0;
  const MAX_SAMPLES = 20;

  if (bikeNodeIds.length >= 2) {
    const step = Math.max(1, Math.floor(bikeNodeIds.length / Math.sqrt(MAX_SAMPLES)));
    for (let i = 0; i < bikeNodeIds.length && directnessSamples < MAX_SAMPLES; i += step) {
      for (let j = i + step; j < bikeNodeIds.length && directnessSamples < MAX_SAMPLES; j += step) {
        const o = bikeNodeCoords.get(bikeNodeIds[i]);
        const d = bikeNodeCoords.get(bikeNodeIds[j]);
        if (!o || !d) continue;
        const straight = haversine(o.lat, o.lng, d.lat, d.lng);
        if (straight < 150) continue;
        const network = dijkstra(bikeNodeIds[i], bikeNodeIds[j], bikeEdgeWeight);
        if (network !== null && network > 0) {
          directnessSum += network / straight;
          directnessSamples++;
        }
      }
    }
  }

  const avgDirectnessRatio = directnessSamples > 0
    ? directnessSum / directnessSamples
    : 2.0;

  // --- C) Transit proximity: % of transit stops within 500 m of bike network ---
  const TRANSIT_RADIUS = 500;
  let transitNearBike = 0;
  const allParkCoords = [
    ...bikeParkingElements.map(e => {
      const g = e.geometry as { coordinates?: number[] } | null;
      return g?.coordinates ? { lat: g.coordinates[1], lng: g.coordinates[0] } : null;
    }).filter(Boolean) as { lat: number; lng: number }[],
    ...proposedParking,
  ];

  for (const stop of transitStops) {
    const nearBike = denseCoords.some(
      p => haversine(stop.latitude, stop.longitude, p.lat, p.lng) <= TRANSIT_RADIUS,
    );
    const nearParking = allParkCoords.some(
      p => haversine(stop.latitude, stop.longitude, p.lat, p.lng) <= TRANSIT_RADIUS,
    );
    if (nearBike || nearParking) transitNearBike++;
  }

  const transitProximityScore = transitStops.length > 0
    ? (transitNearBike / transitStops.length) * 100
    : 0;

  // Composite Accessibility
  const directnessNorm = clamp((1 / avgDirectnessRatio) * 100, 0, 100);

  let accessibilityScore: number;
  if (totalBikeNodes > 0) {
    accessibilityScore = Math.round(
      directnessNorm * 0.35 +
      (transitStops.length > 0 ? transitProximityScore * 0.30 : directnessNorm * 0.30) +
      networkConnectivity * 0.35,
    );
  } else {
    // No bike network at all
    accessibilityScore = Math.round(
      (proposedPoints.length > 0 ? Math.min(proposedPoints.length * 5, 20) : 0) +
      (transitStops.length > 0 ? 5 : 0)
    );
  }

  // Bonus for proposed bike-lane length (more km = better accessibility)
  // Each km of new bike lane adds up to 3 pts, capped at +15
  const lengthBonus = Math.min(totalBikeLaneKm * 3, 15);
  accessibilityScore = Math.round(clamp(accessibilityScore + lengthBonus, 0, 100));

  /* ================================================================ */
  /*  🏆 COMPOSITE VELOSCORE                                          */
  /* ================================================================ */
  const veloScore = Math.round(
    safetyScore * 0.40 +
    coveragePercent * 0.35 +
    accessibilityScore * 0.25,
  );

  /* ---- Build detail payload ------------------------------------- */
  const segmentScores = allBikeSegments.slice(0, 50).map(s => ({
    name: s.name,
    safety: s.kind === "bike_lane" ? 80 : s.kind === "zona_30" ? 65 : 50,
    type: s.kind,
    length: Math.round(s.lengthM),
  }));

  // Transit stops covered within 300 m (backward compat)
  let transitCovered300 = 0;
  for (const stop of transitStops) {
    if (denseCoords.some(p => haversine(stop.latitude, stop.longitude, p.lat, p.lng) <= 300)) {
      transitCovered300++;
    }
  }

  const avgSafetyPerSegment = totalBikeLength > 0 ? safetySum / totalBikeLength : 0;

  return {
    safetyScore,
    coveragePercent,
    conflictZones: conflictZoneLocations.length,
    accessibilityScore,
    veloScore,
    details: {
      totalBikeLaneKm: Math.round(totalBikeLaneKm * 10) / 10,
      connectedComponents,
      avgSafetyPerSegment: Math.round(avgSafetyPerSegment * 10) / 10,
      transitStopsWithBikeAccess: transitCovered300,
      totalTransitStops: transitStops.length,
      conflictZoneLocations,
      segmentScores,
      safetyBreakdown: {
        totalConflictPoints,
        weightedConflictSum: Math.round(totalConflictWeight * 10) / 10,
        bikeLaneKmAnalysed: Math.round(totalBikeLaneKm * 10) / 10,
      },
      coverageBreakdown: {
        gridCellsTotal,
        gridCellsCovered,
        bufferRadiusM: COVERAGE_BUFFER_M,
      },
      accessibilityBreakdown: {
        avgDirectnessRatio: Math.round(avgDirectnessRatio * 100) / 100,
        transitProximityScore: Math.round(transitProximityScore * 10) / 10,
        networkConnectivity: Math.round(networkConnectivity * 10) / 10,
      },
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Utility functions                                                  */
/* ------------------------------------------------------------------ */

/** Infer infrastructure kind from GeoJSON feature properties. */
function inferKind(feature: GeoJSONFeature): string {
  const props = feature.properties || {};
  const name = ((props.name as string) || "").toLowerCase();
  const type = ((props.type as string) || "").toLowerCase();

  if (type.includes("semafor") || name.includes("semafor")) return "semafor";
  if (type.includes("parcare") || name.includes("parcare")) return "parcare_biciclete";
  if (type.includes("zona_30") || name.includes("zona 30") || name.includes("zona_30")) return "zona_30";
  if (type.includes("pietonala") || name.includes("pietonala") || name.includes("pietonală")) return "zona_pietonala";
  if (feature.geometry.type === "Point") return "parcare_biciclete";
  return "bike_lane";
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/** Haversine distance in meters between two lat/lng points. */
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Simple Dijkstra on a weighted adjacency map. */
function dijkstra(
  start: string,
  end: string,
  adj: Map<string, Map<string, number>>,
): number | null {
  const dist = new Map<string, number>();
  dist.set(start, 0);
  const queue: { node: string; d: number }[] = [{ node: start, d: 0 }];
  const visited = new Set<string>();

  while (queue.length > 0) {
    queue.sort((a, b) => a.d - b.d);
    const { node, d } = queue.shift()!;
    if (node === end) return d;
    if (visited.has(node)) continue;
    visited.add(node);

    const neighbors = adj.get(node);
    if (!neighbors) continue;
    for (const [neighbor, weight] of neighbors) {
      if (visited.has(neighbor)) continue;
      const newDist = d + weight;
      if (!dist.has(neighbor) || newDist < dist.get(neighbor)!) {
        dist.set(neighbor, newDist);
        queue.push({ node: neighbor, d: newDist });
      }
    }
  }
  return null;
}
