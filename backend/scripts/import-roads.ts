/**
 * Import GeoJSON road network into the database.
 * Reads principale.geojson, secundare.geojson, strazi_centerline.geojson.
 * Merges nearby nodes within 50m tolerance, skips duplicate segments.
 *
 * Usage: npx ts-node scripts/import-roads.ts
 */
import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();
const MERGE_TOLERANCE = 50; // meters

// ---- Haversine distance in meters ----
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

// ---- Spatial-grid node index for fast nearest-neighbor lookup ----
const GRID_SIZE = 0.0005; // ~55 m at Bucharest latitude

interface MergedNode {
  lat: number;
  lng: number;
  name: string;
}

const mergedNodes: MergedNode[] = [];
const nodeGrid = new Map<string, number[]>();
let mergeCount = 0;

function findOrCreateNode(lat: number, lng: number, name: string): number {
  const gi = Math.floor(lat / GRID_SIZE);
  const gj = Math.floor(lng / GRID_SIZE);

  // Search this cell and its 8 neighbours
  for (let di = -1; di <= 1; di++) {
    for (let dj = -1; dj <= 1; dj++) {
      const key = `${gi + di}_${gj + dj}`;
      const indices = nodeGrid.get(key);
      if (!indices) continue;
      for (const idx of indices) {
        if (haversine(lat, lng, mergedNodes[idx].lat, mergedNodes[idx].lng) < MERGE_TOLERANCE) {
          if (name && (!mergedNodes[idx].name || mergedNodes[idx].name.length < name.length)) {
            mergedNodes[idx].name = name;
          }
          mergeCount++;
          return idx;
        }
      }
    }
  }

  const newIdx = mergedNodes.length;
  mergedNodes.push({ lat, lng, name });
  const gk = `${gi}_${gj}`;
  if (!nodeGrid.has(gk)) nodeGrid.set(gk, []);
  nodeGrid.get(gk)!.push(newIdx);
  return newIdx;
}

// ---- Segment storage & dedup ----
interface SegmentData {
  fromIdx: number;
  toIdx: number;
  name: string;
  roadType: string;
  speedLimit: number;
  trafficLoad: number;
  safetyScore: number;
  coordinates: number[][]; // [lng, lat][]
}

const segments: SegmentData[] = [];
const segmentSet = new Set<string>();
let skipCount = 0;

function segKey(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

function addSegment(seg: SegmentData): boolean {
  if (seg.fromIdx === seg.toIdx) return false;
  const key = segKey(seg.fromIdx, seg.toIdx);
  if (segmentSet.has(key)) {
    skipCount++;
    return false;
  }
  segmentSet.add(key);
  segments.push(seg);
  return true;
}

// ---- Compute geometry length by summing consecutive-pair distances ----
function geometryLength(coords: number[][]): number {
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    total += haversine(coords[i - 1][1], coords[i - 1][0], coords[i][1], coords[i][0]);
  }
  return total;
}

// ---- Process one LineString ----
function processLineString(
  coords: number[][],
  name: string,
  roadType: string,
  speedLimit: number,
  trafficLoad: number,
  safetyScore: number
) {
  if (coords.length < 2) return;

  // Build node at every vertex (50 m merge handles real intersections)
  const nodeIndices: number[] = [];
  for (const [lng, lat] of coords) {
    nodeIndices.push(findOrCreateNode(lat, lng, name));
  }

  // Create segments between consecutive *distinct* nodes
  let lastIdx = nodeIndices[0];
  let lastCoordStart = 0;
  for (let i = 1; i < nodeIndices.length; i++) {
    if (nodeIndices[i] !== lastIdx) {
      const segCoords = coords.slice(lastCoordStart, i + 1);
      addSegment({
        fromIdx: lastIdx,
        toIdx: nodeIndices[i],
        name,
        roadType,
        speedLimit,
        trafficLoad,
        safetyScore,
        coordinates: segCoords,
      });
      lastIdx = nodeIndices[i];
      lastCoordStart = i;
    }
  }
}

// ---- Process one feature (handles both LineString and MultiLineString) ----
function processFeature(
  geometry: { type: string; coordinates: any },
  name: string,
  roadType: string,
  speedLimit: number,
  trafficLoad: number,
  safetyScore: number
) {
  if (geometry.type === "LineString") {
    processLineString(geometry.coordinates, name, roadType, speedLimit, trafficLoad, safetyScore);
  } else if (geometry.type === "MultiLineString") {
    for (const lineCoords of geometry.coordinates) {
      processLineString(lineCoords, name, roadType, speedLimit, trafficLoad, safetyScore);
    }
  }
}

// ---- Map strazi_centerline tipstrada to road properties ----
function streetProps(tipstrada: string) {
  const tip = (tipstrada || "").toLowerCase();
  if (tip.includes("bulevard") || tip.includes("splai"))
    return { type: "car_only", speed: 50, traffic: 0.8, safety: 30 };
  if (tip.includes("sosea") || tip.includes("calea") || tip.includes("şoseaua"))
    return { type: "car_only", speed: 50, traffic: 0.7, safety: 35 };
  if (tip.includes("alee") || tip.includes("intrare") || tip.includes("pasaj"))
    return { type: "shared", speed: 30, traffic: 0.3, safety: 55 };
  if (tip.includes("pietonal") || tip.includes("piata"))
    return { type: "pedestrian", speed: 15, traffic: 0, safety: 90 };
  // Default: regular street
  return { type: "car_only", speed: 50, traffic: 0.5, safety: 40 };
}

// ===================== MAIN =====================
async function main() {
  const geojsonDir = path.resolve(__dirname, "../../map geojson");

  console.log("🗺️  Importing road network from GeoJSON files...\n");

  // --- 1. principale.geojson  (main bike corridors — highest priority) ---
  const principale = JSON.parse(
    fs.readFileSync(path.join(geojsonDir, "principale.geojson"), "utf-8")
  );
  for (const f of principale.features) {
    const name: string = f.properties.name || "Pistă principală";
    processFeature(f.geometry, name, "bike_lane", 30, 0.2, 75);
  }
  console.log(`✅ principale.geojson  — ${principale.features.length} features`);

  // --- 2. secundare.geojson  (secondary bike corridors) ---
  const secundare = JSON.parse(
    fs.readFileSync(path.join(geojsonDir, "secundare.geojson"), "utf-8")
  );
  for (const f of secundare.features) {
    const name: string = f.properties.name || f.properties.Nume || "Pistă secundară";
    processFeature(f.geometry, name, "bike_lane", 30, 0.3, 70);
  }
  console.log(`✅ secundare.geojson   — ${secundare.features.length} features`);

  // --- 3. strazi_centerline.geojson  (general street network) ---
  const centerline = JSON.parse(
    fs.readFileSync(path.join(geojsonDir, "strazi_centerline.geojson"), "utf-8")
  );
  for (const f of centerline.features) {
    const name: string = f.properties.strada || "";
    const props = streetProps(f.properties.tipstrada);
    processFeature(f.geometry, name, props.type, props.speed, props.traffic, props.safety);
  }
  console.log(`✅ strazi_centerline   — ${centerline.features.length} features`);

  // --- Summary ---
  console.log(
    `\n📊 Totals: ${mergedNodes.length} unique nodes, ${segments.length} segments` +
      `\n   Merged ${mergeCount} vertices within ${MERGE_TOLERANCE}m, skipped ${skipCount} duplicate segments\n`
  );

  // --- Clear existing road data ---
  console.log("🗑️  Clearing existing road data...");
  await prisma.roadSegment.deleteMany();
  await prisma.roadNode.deleteMany();

  // --- Insert nodes one by one ---
  console.log("📍 Inserting road nodes...");
  const nodeIds: string[] = [];
  for (let i = 0; i < mergedNodes.length; i++) {
    const n = mergedNodes[i];
    const created = await prisma.roadNode.create({
      data: { latitude: +n.lat, longitude: +n.lng, name: n.name },
    });
    nodeIds.push(created.id);
    if ((i + 1) % 500 === 0 || i === mergedNodes.length - 1) {
      process.stdout.write(`\r  ${i + 1} / ${mergedNodes.length} nodes`);
    }
  }
  console.log();

  // --- Insert segments one by one ---
  console.log("🛣️  Inserting road segments...");
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    await prisma.roadSegment.create({
      data: {
        fromNodeId: nodeIds[seg.fromIdx],
        toNodeId: nodeIds[seg.toIdx],
        name: seg.name,
        length: geometryLength(seg.coordinates),
        roadType: seg.roadType,
        speedLimit: seg.speedLimit,
        trafficLoad: +seg.trafficLoad,
        safetyScore: +seg.safetyScore,
        geometry: {
          type: "LineString",
          coordinates: seg.coordinates,
        },
      },
    });
    if ((i + 1) % 500 === 0 || i === segments.length - 1) {
      process.stdout.write(`\r  ${i + 1} / ${segments.length} segments`);
    }
  }
  console.log();

  console.log(`\n🎉 Import complete! ${nodeIds.length} nodes, ${segments.length} segments`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
