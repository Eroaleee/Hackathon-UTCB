/**
 * GTFS Import Script — Parses INFO/*.txt files and imports transit data
 * filtered to Sector 2 Bucharest bounding box.
 * 
 * Usage: npx ts-node scripts/import-gtfs.ts
 */
import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

// Sector 2 bounding box (generous to include adjacent areas cyclists might use)
const BOUNDS = {
  minLat: 44.41,
  maxLat: 44.49,
  minLng: 26.08,
  maxLng: 26.20,
};

function parseCsv(filePath: string): Record<string, string>[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const values: string[] = [];
    let current = "";
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === "," && !inQuotes) { values.push(current.trim()); current = ""; continue; }
      current += ch;
    }
    values.push(current.trim());
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = values[i] || ""; });
    return obj;
  });
}

function inBounds(lat: number, lng: number) {
  return lat >= BOUNDS.minLat && lat <= BOUNDS.maxLat && lng >= BOUNDS.minLng && lng <= BOUNDS.maxLng;
}

async function importStops() {
  const infoDir = path.resolve(__dirname, "../../INFO");
  const rows = parseCsv(path.join(infoDir, "stops.txt"));
  const stops = rows
    .filter((r) => {
      const lat = parseFloat(r.stop_lat);
      const lng = parseFloat(r.stop_lon);
      return !isNaN(lat) && !isNaN(lng) && inBounds(lat, lng);
    })
    .map((r) => ({
      id: r.stop_id,
      name: r.stop_name,
      latitude: parseFloat(r.stop_lat),
      longitude: parseFloat(r.stop_lon),
      type: parseInt(r.location_type || "0") || 0,
      parentId: r.parent_station || null,
    }));

  console.log(`Found ${stops.length} stops in Sector 2 bounds`);

  // Upsert in batches
  for (const stop of stops) {
    await prisma.transitStop.upsert({
      where: { id: stop.id },
      update: { name: stop.name, latitude: stop.latitude, longitude: stop.longitude, type: stop.type, parentId: stop.parentId },
      create: stop,
    });
  }
  console.log(`Imported ${stops.length} transit stops`);
}

async function importRoutes() {
  const infoDir = path.resolve(__dirname, "../../INFO");
  const rows = parseCsv(path.join(infoDir, "routes.txt"));
  const routes = rows.map((r) => ({
    id: r.route_id,
    shortName: r.route_short_name || "",
    longName: r.route_long_name || "",
    type: parseInt(r.route_type || "3"),
    color: r.route_color ? `#${r.route_color}` : "",
    agencyId: r.agency_id || "",
  }));

  console.log(`Found ${routes.length} routes total`);
  for (const route of routes) {
    await prisma.transitRoute.upsert({
      where: { id: route.id },
      update: route,
      create: route,
    });
  }
  console.log(`Imported ${routes.length} transit routes`);
}

async function importShapes() {
  const infoDir = path.resolve(__dirname, "../../INFO");
  const rows = parseCsv(path.join(infoDir, "shapes.txt"));

  // Group shape points by shape_id
  const shapeGroups = new Map<string, { lat: number; lng: number; seq: number }[]>();
  for (const r of rows) {
    const lat = parseFloat(r.shape_pt_lat);
    const lng = parseFloat(r.shape_pt_lon);
    if (isNaN(lat) || isNaN(lng)) continue;
    const id = r.shape_id;
    if (!shapeGroups.has(id)) shapeGroups.set(id, []);
    shapeGroups.get(id)!.push({ lat, lng, seq: parseInt(r.shape_pt_sequence || "0") });
  }

  console.log(`Found ${shapeGroups.size} unique shapes`);

  // Filter shapes that have at least some points in Sector 2
  let importedCount = 0;
  for (const [shapeId, points] of shapeGroups) {
    points.sort((a, b) => a.seq - b.seq);
    const hasPointInBounds = points.some((p) => inBounds(p.lat, p.lng));
    if (!hasPointInBounds) continue;

    const geometry = {
      type: "LineString",
      coordinates: points.map((p) => [p.lng, p.lat]),
    };

    // Check if already exists
    const existing = await prisma.transitShape.findFirst({ where: { shapeId } });
    if (!existing) {
      await prisma.transitShape.create({
        data: { shapeId, geometry },
      });
      importedCount++;
    }
  }
  console.log(`Imported ${importedCount} shapes passing through Sector 2`);
}

async function linkShapesToRoutes() {
  const infoDir = path.resolve(__dirname, "../../INFO");
  const tripsRows = parseCsv(path.join(infoDir, "trips.txt"));

  // Build shape_id -> route_id mapping (first match)
  const shapeRouteMap = new Map<string, string>();
  for (const r of tripsRows) {
    if (r.shape_id && r.route_id && !shapeRouteMap.has(r.shape_id)) {
      shapeRouteMap.set(r.shape_id, r.route_id);
    }
  }

  // Update shapes with route links
  const shapes = await prisma.transitShape.findMany();
  let linked = 0;
  for (const shape of shapes) {
    const routeId = shapeRouteMap.get(shape.shapeId);
    if (routeId) {
      const routeExists = await prisma.transitRoute.findUnique({ where: { id: routeId } });
      if (routeExists) {
        await prisma.transitShape.update({
          where: { id: shape.id },
          data: { routeId },
        });
        linked++;
      }
    }
  }
  console.log(`Linked ${linked} shapes to routes`);
}

async function buildRoadNetwork() {
  // Fetch real road geometries from OpenStreetMap via Overpass API
  const bbox = `${BOUNDS.minLat},${BOUNDS.minLng},${BOUNDS.maxLat},${BOUNDS.maxLng}`;
  const query = `
[out:json][timeout:120];
(
  way["highway"="cycleway"](${bbox});
  way["highway"]["cycleway"](${bbox});
  way["highway"~"^(primary|secondary|tertiary|unclassified|living_street|residential)$"](${bbox});
);
out body;
>;
out skel qt;
`;

  console.log("  Fetching road data from OpenStreetMap Overpass API...");
  let resp: Response | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      resp = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(query)}`,
      });
      if (resp.ok) break;
      console.log(`  Attempt ${attempt} failed (${resp.status}), retrying in 10s...`);
    } catch (e: any) {
      console.log(`  Attempt ${attempt} network error: ${e.message}, retrying in 10s...`);
    }
    await new Promise((r) => setTimeout(r, 10000));
  }
  if (!resp || !resp.ok) throw new Error(`Overpass API failed after 3 attempts`);
  const data: any = await resp.json();
  const elements: any[] = data.elements;

  // ---- Parse OSM nodes ----
  const osmNodes = new Map<number, { lat: number; lng: number }>();
  for (const el of elements) {
    if (el.type === "node") osmNodes.set(el.id, { lat: el.lat, lng: el.lon });
  }

  // ---- Parse OSM ways ----
  const osmWays: { id: number; nodeRefs: number[]; tags: Record<string, string> }[] = [];
  for (const el of elements) {
    if (el.type === "way" && el.tags?.highway) {
      osmWays.push({ id: el.id, nodeRefs: el.nodes, tags: el.tags });
    }
  }
  console.log(`  Parsed ${osmNodes.size} OSM nodes, ${osmWays.length} ways`);

  // ---- Find intersection nodes (referenced by ≥2 ways, or way endpoints) ----
  const refCount = new Map<number, number>();
  for (const w of osmWays) {
    // endpoints always count double so they become intersections
    for (const nid of w.nodeRefs) refCount.set(nid, (refCount.get(nid) || 0) + 1);
    refCount.set(w.nodeRefs[0], (refCount.get(w.nodeRefs[0]) || 0) + 1);
    refCount.set(w.nodeRefs[w.nodeRefs.length - 1], (refCount.get(w.nodeRefs[w.nodeRefs.length - 1]) || 0) + 1);
  }
  const isIntersection = (nid: number) => (refCount.get(nid) || 0) >= 2;

  // ---- Clear existing road data ----
  await prisma.roadSegment.deleteMany();
  await prisma.roadNode.deleteMany();

  // ---- Create Prisma road nodes for every intersection ----
  const prismaNodeMap = new Map<number, string>(); // osmNodeId → prisma id
  for (const w of osmWays) {
    for (let i = 0; i < w.nodeRefs.length; i++) {
      const nid = w.nodeRefs[i];
      if (i === 0 || i === w.nodeRefs.length - 1 || isIntersection(nid)) {
        if (!prismaNodeMap.has(nid)) {
          const c = osmNodes.get(nid);
          if (!c) continue;
          const node = await prisma.roadNode.create({
            data: { latitude: c.lat, longitude: c.lng, name: w.tags.name || "" },
          });
          prismaNodeMap.set(nid, node.id);
        }
      }
    }
  }
  console.log(`  Created ${prismaNodeMap.size} road nodes`);

  // ---- Create road segments by splitting ways at intersections ----
  let segCount = 0;
  for (const w of osmWays) {
    const { roadType, speedLimit, baseSafety, trafficLoad } = classifyWay(w.tags);
    let segStart = 0;

    for (let i = 1; i < w.nodeRefs.length; i++) {
      if (i === w.nodeRefs.length - 1 || isIntersection(w.nodeRefs[i])) {
        const fromId = prismaNodeMap.get(w.nodeRefs[segStart]);
        const toId = prismaNodeMap.get(w.nodeRefs[i]);

        if (fromId && toId && fromId !== toId) {
          const coords: number[][] = [];
          let len = 0;
          for (let j = segStart; j <= i; j++) {
            const c = osmNodes.get(w.nodeRefs[j]);
            if (!c) continue;
            coords.push([c.lng, c.lat]);
            if (j > segStart) {
              const prev = osmNodes.get(w.nodeRefs[j - 1]);
              if (prev) len += haversine(prev.lat, prev.lng, c.lat, c.lng);
            }
          }
          if (coords.length >= 2 && len > 1) {
            await prisma.roadSegment.create({
              data: {
                fromNodeId: fromId,
                toNodeId: toId,
                name: w.tags.name || "",
                length: len,
                roadType,
                speedLimit,
                trafficLoad,
                safetyScore: Math.max(baseSafety - trafficLoad * 15, 5),
                geometry: { type: "LineString", coordinates: coords },
              },
            });
            segCount++;
          }
        }
        segStart = i;
      }
    }
  }
  console.log(`  Created ${segCount} road segments`);
}

/** Classify an OSM way by its tags into our road type system */
function classifyWay(tags: Record<string, string>) {
  const hw = tags.highway;
  const cy = tags.cycleway;
  const ms = parseInt(tags.maxspeed) || 0;

  if (hw === "cycleway")
    return { roadType: "bike_lane", speedLimit: ms || 25, baseSafety: 90, trafficLoad: 0.1 };

  if (cy === "lane" || cy === "track" || cy === "dedicated")
    return {
      roadType: "bike_lane", speedLimit: ms || 50, baseSafety: 80,
      trafficLoad: hw === "primary" ? 0.7 : hw === "secondary" ? 0.5 : 0.3,
    };

  if (cy === "shared_lane" || cy === "share_busway")
    return { roadType: "shared", speedLimit: ms || 50, baseSafety: 50, trafficLoad: 0.5 };

  if (hw === "pedestrian" || hw === "footway" || hw === "path")
    return { roadType: "pedestrian", speedLimit: ms || 15, baseSafety: 92, trafficLoad: 0.05 };

  if (hw === "living_street")
    return { roadType: "shared", speedLimit: ms || 20, baseSafety: 70, trafficLoad: 0.15 };

  if (hw === "tertiary" || hw === "tertiary_link" || hw === "unclassified")
    return { roadType: ms && ms <= 30 ? "shared" : "car_only", speedLimit: ms || 50, baseSafety: 35, trafficLoad: 0.4 };

  if (hw === "secondary" || hw === "secondary_link")
    return { roadType: "car_only", speedLimit: ms || 50, baseSafety: 25, trafficLoad: 0.6 };

  if (hw === "primary" || hw === "primary_link")
    return { roadType: "car_only", speedLimit: ms || 50, baseSafety: 18, trafficLoad: 0.8 };

  return { roadType: "car_only", speedLimit: ms || 50, baseSafety: 30, trafficLoad: 0.3 };
}

/** Create infrastructure layer elements from the bike-lane road segments */
async function buildInfraFromRoads() {
  // Ensure layers exist
  const layerDefs = [
    { type: "pista_biciclete",    label: "Piste de biciclete",   color: "#a3e635", icon: "🚲", isDefaultVisible: true },
    { type: "parcare_biciclete",  label: "Parcări de biciclete", color: "#22d3ee", icon: "🅿️", isDefaultVisible: true },
    { type: "semafor",            label: "Semafoare bicicliști", color: "#f59e0b", icon: "🚦", isDefaultVisible: false },
    { type: "zona_30",            label: "Zone 30 km/h",        color: "#818cf8", icon: "🐌", isDefaultVisible: false },
    { type: "zona_pietonala",     label: "Zone pietonale",       color: "#34d399", icon: "🚶", isDefaultVisible: false },
  ];
  const layerMap: Record<string, string> = {};
  for (const l of layerDefs) {
    const layer = await prisma.infrastructureLayer.upsert({
      where: { type: l.type },
      update: { label: l.label, color: l.color, icon: l.icon, isDefaultVisible: l.isDefaultVisible },
      create: l,
    });
    layerMap[l.type] = layer.id;
  }

  // Delete only road-derived infra elements (keep seed's Point elements like parking, signals)
  await prisma.infrastructureElement.deleteMany({ where: { type: { in: ["pista_biciclete", "zona_pietonala"] } } });

  // Create bike-lane elements from road segments
  const bikeSegs = await prisma.roadSegment.findMany({ where: { roadType: "bike_lane" } });
  let count = 0;
  for (const seg of bikeSegs) {
    if (!seg.geometry) continue;
    await prisma.infrastructureElement.create({
      data: {
        layerId: layerMap["pista_biciclete"],
        type: "pista_biciclete",
        typeLabel: "Pistă de biciclete",
        name: seg.name || "Pistă ciclabilă",
        geometry: seg.geometry as any,
        properties: {},
      },
    });
    count++;
  }

  // Create pedestrian zone elements
  const pedSegs = await prisma.roadSegment.findMany({ where: { roadType: "pedestrian" } });
  for (const seg of pedSegs) {
    if (!seg.geometry) continue;
    await prisma.infrastructureElement.create({
      data: {
        layerId: layerMap["zona_pietonala"],
        type: "zona_pietonala",
        typeLabel: "Zonă pietonală",
        name: seg.name || "Alee / cărare",
        geometry: seg.geometry as any,
        properties: {},
      },
    });
    count++;
  }

  console.log(`  Created ${count} infrastructure elements from road segments`);
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function main() {
  console.log("=== VeloCivic GTFS + OSM Import ===\n");

  console.log("1. Importing transit stops...");
  await importStops();

  console.log("\n2. Importing transit routes...");
  await importRoutes();

  console.log("\n3. Importing transit shapes...");
  await importShapes();

  console.log("\n4. Linking shapes to routes...");
  await linkShapesToRoutes();

  console.log("\n5. Building road network from OpenStreetMap...");
  await buildRoadNetwork();

  console.log("\n6. Creating infrastructure layers from road data...");
  await buildInfraFromRoads();

  console.log("\n=== Import complete! ===");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
