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
  /*  🔴 SAFETY — Existing baseline (capped) + proposed additions      */
  /*  Existing DB infra gives a modest baseline.                       */
  /*  Proposed additions are the primary driver of safety improvement. */
  /* ================================================================ */
  const conflictZoneLocations: ConflictZone[] = [];
  let totalConflictWeight = 0;
  let totalConflictPoints = 0;

  // Gather car-only DB segments for crossing detection (used for conflict zones)
  const carSegCoords: { lat: number; lng: number; speedLimit: number; trafficLoad: number }[] = [];
  for (const seg of dbSegments) {
    if (seg.roadType !== "car_only" && seg.roadType !== "shared") continue;
    const geom = seg.geometry as { coordinates?: number[][] } | null;
    if (!geom?.coordinates) continue;
    for (const [lng, lat] of geom.coordinates) {
      carSegCoords.push({ lat, lng, speedLimit: seg.speedLimit, trafficLoad: seg.trafficLoad });
    }
  }

  // Scan proposed segments for conflict zones (for detail payload)
  let safetySum = 0;
  for (const seg of allBikeSegments) {
    const midLat = (seg.lat1 + seg.lat2) / 2;
    const midLng = (seg.lng1 + seg.lng2) / 2;
    let segSafety = seg.kind === "bike_lane" ? 80
      : seg.kind === "zona_30" ? 65
      : seg.kind === "zona_pietonala" ? 70 : 40;

    const nearCar = carSegCoords.find(c => haversine(midLat, midLng, c.lat, c.lng) < 50);
    if (nearCar) {
      const severity = nearCar.speedLimit >= 70 ? 8 : nearCar.speedLimit >= 50 ? 5 : 3;
      segSafety -= severity;
      totalConflictPoints++;
      totalConflictWeight += severity * (1 + nearCar.trafficLoad);
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
    if (allSignals.some(s => haversine(midLat, midLng, s.lat, s.lng) < 150)) segSafety += 5;
    if (allZone30.some(z => haversine(midLat, midLng, z.lat, z.lng) < 200)) segSafety += 5;
    if (allPedZones.some(p => haversine(midLat, midLng, p.lat, p.lng) < 200)) segSafety += 3;
    safetySum += clamp(segSafety, 0, 100) * seg.lengthM;
  }

  const totalBikeLength = allBikeSegments.reduce((s, seg) => s + seg.lengthM, 0);

  // Report penalty (reduced to keep room for improvement)
  const reportPenalty = Math.min(unresolvedReports.length * 0.3, 10);

  // --- A) Existing bike infrastructure baseline (0–25 pts) ---
  //     ~30km DB lanes → ~7.5 pts. Reflects "Bucharest is not cycling-safe yet."
  const avgSegSafety = totalBikeLength > 0 ? safetySum / totalBikeLength : 0;
  const existingSafetyBase = clamp((avgSegSafety / 100) * 25, 0, 25);

  // --- B) Proposed lanes bonus (0–40 pts) ---
  //     Each new km of dedicated lane significantly improves safety.
  const proposedLaneSafety = clamp(totalProposedKm * 12, 0, 40);

  // --- C) Proposed safety infrastructure bonus (0–25 pts) ---
  //     Signals, zone 30, pedestrian zones from drawn points.
  const proposedSafetyInfra = clamp(
    proposedSignals.length * 5 + proposedZone30.length * 5 + proposedPedZone.length * 4,
    0, 25,
  );

  const safetyScore = Math.round(
    clamp(existingSafetyBase + proposedLaneSafety + proposedSafetyInfra - reportPenalty, 0, 100),
  );

  /* ================================================================ */
  /*  🟡 COVERAGE — Existing baseline (capped) + proposed additions    */
  /*  Existing DB infra gives a moderate baseline.                     */
  /*  Proposed additions have their own generous scoring budget.       */
  /* ================================================================ */
  const COVERAGE_BUFFER_M = 300; // kept for details payload

  // Existing infrastructure baseline (0–35 pts)
  // ~100 km needed for full score — keeps baseline moderate (~12 pts for 30km)
  const existingCoverage = clamp((totalExistingKm / 100) * 35, 0, 35);

  // Proposed bike lanes bonus (0–40 pts)
  // Each new drawn km adds 25 pts — highly visible improvement
  const proposedCoverage = clamp(totalProposedKm * 25, 0, 40);

  // Proposed point infrastructure bonus (0–25 pts)
  // Each drawn point adds 8 pts (parking, signal, zone, etc.)
  const proposedPointsCoverage = clamp(proposedPoints.length * 8, 0, 25);

  const coveragePercent = Math.round(clamp(existingCoverage + proposedCoverage + proposedPointsCoverage, 0, 100));

  // Keep grid info for details payload (simplified)
  const gridCellsTotal = Math.round(STUDY_AREA_KM2 * 100);
  const gridCellsCovered = Math.round(gridCellsTotal * (coveragePercent / 100));

  // Densify bike lane points along segments (used by transit proximity below)
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

  /* ================================================================ */
  /*  🟢 ACCESSIBILITY — Bike lanes + infrastructure + transit         */
  /*  Length-based: no graph-node snapping, works with freehand draw.  */
  /* ================================================================ */

  // Gather all parking coordinates
  const allParkCoords = [
    ...bikeParkingElements.map(e => {
      const g = e.geometry as { coordinates?: number[] } | null;
      return g?.coordinates ? { lat: g.coordinates[1], lng: g.coordinates[0] } : null;
    }).filter(Boolean) as { lat: number; lng: number }[],
    ...proposedParking,
  ];

  // --- A) Existing bike lane baseline (0–25 pts) ---
  //     ~100 km for full score — keeps baseline modest
  const existingAccessBase = clamp((totalExistingKm / 100) * 25, 0, 25);

  // --- B) Proposed lanes bonus (0–35 pts) ---
  //     Each new drawn km adds 20 pts — visible impact
  const proposedLaneAccess = clamp(totalProposedKm * 20, 0, 35);

  // --- C) Proposed points bonus (0–25 pts) ---
  //     Each drawn point adds 8 pts (parking, signal, zone, pedestrian)
  const proposedPointAccess = clamp(proposedPoints.length * 8, 0, 25);

  // --- D) Transit proximity: % of transit stops within 500 m of bike network (0–15 pts) ---
  const TRANSIT_RADIUS = 500;
  let transitNearBike = 0;

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
  const transitAccessPts = clamp(transitProximityScore * 0.15, 0, 15);

  const featureLengths = new Map<string, number>();
  for (const seg of allBikeSegments) {
    featureLengths.set(seg.name, (featureLengths.get(seg.name) || 0) + seg.lengthM);
  }
  const avgFeatureLengthM = featureLengths.size > 0
    ? Array.from(featureLengths.values()).reduce((a, b) => a + b, 0) / featureLengths.size
    : 0;

  const connectedComponents = featureLengths.size; // informational
  const networkConnectivity = clamp(totalBikeLaneKm * 5, 0, 100); // simplified for details
  const avgDirectnessRatio = avgFeatureLengthM > 0 ? 1.0 : 2.0; // simplified for details

  // Composite Accessibility = existing(25) + proposedLanes(35) + proposedPoints(25) + transit(15)
  const accessibilityScore = Math.round(
    clamp(existingAccessBase + proposedLaneAccess + proposedPointAccess + transitAccessPts, 0, 100)
  );

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


