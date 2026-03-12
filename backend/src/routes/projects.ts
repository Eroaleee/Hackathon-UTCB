import { Router, Request, Response } from "express";
import { asyncHandler } from "../middleware/async-handler";
import prisma from "../prisma";
import { requireAuth, requireAdmin, optionalAuth } from "../middleware/auth";
import { notifyProjectFollowers } from "../services/gamification";

const router = Router();

/** GET /api/projects — Public: list all projects with like/follow counts */
router.get("/", asyncHandler(async (req: Request, res: Response) => {
  const { stage } = req.query;
  const user = (req as any).user;

  const where: any = {};
  if (stage) where.stage = stage;

  const projects = await prisma.project.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { comments: true, followers: true, likes: true } },
      followers: user ? { where: { userId: user.id } } : false,
      likes: user ? { where: { userId: user.id } } : false,
      comments: {
        where: { parentId: null },
        include: {
          user: { select: { id: true, nickname: true, avatar: true } },
          replies: {
            include: {
              user: { select: { id: true, nickname: true, avatar: true } },
            },
          },
        },
        orderBy: { createdAt: "asc" },
        take: 5,
      },
    },
  });

  const result = projects.map((p: any) => ({
    ...p,
    followers: p._count.followers,
    likes: p._count.likes + (p.anonymousLikes || 0),
    commentCount: p._count.comments,
    isFollowing: user ? (p.followers as any[]).length > 0 : false,
    isLiked: user ? (p.likes as any[]).length > 0 : false,
  }));

  res.json(result);
}));

/** GET /api/projects/:id — Public: single project with comments */
router.get("/:id", asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const user = (req as any).user;

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      _count: { select: { comments: true, followers: true, likes: true } },
      followers: user ? { where: { userId: user.id } } : false,
      likes: user ? { where: { userId: user.id } } : false,
      comments: {
        where: { parentId: null },
        include: {
          user: { select: { id: true, nickname: true, avatar: true } },
          replies: {
            include: {
              user: { select: { id: true, nickname: true, avatar: true } },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!project) {
    res.status(404).json({ error: "Proiectul nu a fost găsit." });
    return;
  }

  res.json({
    ...project,
    followers: project._count.followers,
    likes: project._count.likes + (project.anonymousLikes || 0),
    commentCount: project._count.comments,
    isFollowing: user ? (project.followers as any[]).length > 0 : false,
    isLiked: user ? (project.likes as any[]).length > 0 : false,
  });
}));

/** POST /api/projects/:id/like — toggle like (auth) or anonymous like */
router.post("/:id/like", optionalAuth, asyncHandler(async (req: Request, res: Response) => {
  const projectId = req.params.id as string;
  const user = (req as any).user;

  if (!user) {
    // Anonymous like – just increment counter
    await prisma.project.update({ where: { id: projectId }, data: { anonymousLikes: { increment: 1 } } });
    res.json({ liked: true });
    return;
  }

  const existing = await prisma.projectLike.findUnique({
    where: { userId_projectId: { userId: user.id, projectId } },
  });

  if (existing) {
    await prisma.projectLike.delete({ where: { id: existing.id } });
    res.json({ liked: false });
    return;
  }

  await prisma.projectLike.create({
    data: { userId: user.id, projectId },
  });

  res.json({ liked: true });
}));

/** POST /api/projects/:id/follow — Auth required: toggle follow */
router.post("/:id/follow", requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const projectId = req.params.id as string;
  const user = (req as any).user;

  const existing = await prisma.projectFollow.findUnique({
    where: { userId_projectId: { userId: user.id, projectId } },
  });

  if (existing) {
    await prisma.projectFollow.delete({ where: { id: existing.id } });
    res.json({ following: false });
    return;
  }

  await prisma.projectFollow.create({
    data: { userId: user.id, projectId },
  });

  res.json({ following: true });
}));

/** POST /api/projects — Admin: create a project */
router.post("/", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { title, description, image, stage, stageLabel, projectType, budget, timeline, team, startDate, endDate, workingHours, latitude, longitude, address, geometry, connectedRouteIds, proposalId } = req.body;

  if (!title || !description || !timeline || latitude == null || longitude == null || !address) {
    res.status(400).json({ error: "Câmpuri obligatorii lipsă." });
    return;
  }

  const project = await prisma.project.create({
    data: {
      title,
      description,
      image: image || null,
      stage: stage || "simulare",
      stageLabel: stageLabel || "Simulare",
      projectType: projectType || "infrastructura_mixta",
      budget: budget || null,
      timeline,
      team: team || null,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      workingHours: workingHours || null,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      address,
      geometry: geometry || null,
      connectedRouteIds: connectedRouteIds || [],
      proposalId: proposalId || null,
    },
  });

  res.status(201).json(project);
}));

/** PATCH /api/projects/:id — Admin: update a project */
router.patch("/:id", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { title, description, image, stage, stageLabel, projectType, budget, timeline, team, startDate, endDate, workingHours, latitude, longitude, address, geometry, simulationResults, connectedRouteIds } = req.body;

  const data: any = {};
  if (title !== undefined) data.title = title;
  if (description !== undefined) data.description = description;
  if (image !== undefined) data.image = image;
  if (stage !== undefined) data.stage = stage;
  if (stageLabel !== undefined) data.stageLabel = stageLabel;
  if (projectType !== undefined) data.projectType = projectType;
  if (budget !== undefined) data.budget = budget;
  if (timeline !== undefined) data.timeline = timeline;
  if (team !== undefined) data.team = team;
  if (startDate !== undefined) data.startDate = startDate ? new Date(startDate) : null;
  if (endDate !== undefined) data.endDate = endDate ? new Date(endDate) : null;
  if (workingHours !== undefined) data.workingHours = workingHours;
  if (latitude !== undefined) data.latitude = parseFloat(latitude);
  if (longitude !== undefined) data.longitude = parseFloat(longitude);
  if (address !== undefined) data.address = address;
  if (geometry !== undefined) data.geometry = geometry;
  if (simulationResults !== undefined) data.simulationResults = simulationResults;
  if (connectedRouteIds !== undefined) data.connectedRouteIds = connectedRouteIds;

  const project = await prisma.project.update({
    where: { id },
    data,
  });

  // When a project is finalized, convert its geometry into bike_lane road segments
  if (stage === "finalizat" && project.geometry) {
    try {
      await applyProjectToRoadNetwork(project);
    } catch (e) { /* non-blocking — don't fail the PATCH */ }
  }

  // When a project is backtracked FROM finalizat, remove its infrastructure elements
  if (stage !== undefined && stage !== "finalizat") {
    try {
      await removeProjectInfrastructure(id);
    } catch { /* non-blocking */ }
  }

  // Notify followers about updates
  if (stage !== undefined || title !== undefined) {
    try {
      await notifyProjectFollowers(id, "Proiect actualizat", `Proiectul "${project.title}" a fost actualizat.`);
    } catch { /* non-blocking */ }
  }

  res.json(project);
}));

/** POST /api/projects/from-proposal/:proposalId — Admin: convert a proposal into a project */
router.post("/from-proposal/:proposalId", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  try {
    const proposalId = req.params.proposalId as string;
    const proposal = await prisma.proposal.findUnique({ where: { id: proposalId } });
    if (!proposal) { res.status(404).json({ error: "Propunerea nu a fost găsită." }); return; }

    const project = await prisma.project.create({
      data: {
        title: proposal.title,
        description: proposal.description,
        stage: "simulare",
        stageLabel: "Simulare",
        timeline: "TBD",
        latitude: proposal.latitude,
        longitude: proposal.longitude,
        address: proposal.address,
        geometry: proposal.geometry ?? undefined,
      },
    });

    // Mark proposal as in_implementare
    await prisma.proposal.update({
      where: { id: proposalId },
      data: { status: "in_implementare" },
    });

    res.status(201).json(project);
  } catch (e: any) {
    res.status(500).json({ error: "Eroare.", details: e.message });
  }
}));

/** DELETE /api/projects/:id — Admin: delete a project */
router.delete("/:id", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  await prisma.project.delete({ where: { id } });
  res.json({ deleted: true });
}));

// ------------------------------------------------------------------
// Apply finalized project geometry to road network as bike lanes
// ------------------------------------------------------------------

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Extract [lng, lat][] coordinates from any shape of GeoJSON stored in project.geometry */
function extractCoords(geometry: any): number[][] {
  if (!geometry) return [];
  // Direct LineString
  if (geometry.type === "LineString" && Array.isArray(geometry.coordinates)) {
    return geometry.coordinates;
  }
  // FeatureCollection — collect all LineString geometries
  if (geometry.type === "FeatureCollection" && Array.isArray(geometry.features)) {
    const coords: number[][] = [];
    for (const f of geometry.features) {
      if (f.geometry?.type === "LineString") coords.push(...f.geometry.coordinates);
    }
    return coords;
  }
  // Feature wrapping a LineString
  if (geometry.type === "Feature" && geometry.geometry?.type === "LineString") {
    return geometry.geometry.coordinates;
  }
  return [];
}

/** Distance from a point to a line segment (in meters) */
function pointToSegDist(
  pLat: number, pLng: number,
  aLat: number, aLng: number,
  bLat: number, bLng: number,
): number {
  const dx = bLng - aLng, dy = bLat - aLat;
  if (dx === 0 && dy === 0) return haversineM(pLat, pLng, aLat, aLng);
  let t = ((pLng - aLng) * dx + (pLat - aLat) * dy) / (dx * dx + dy * dy);
  t = Math.max(0, Math.min(1, t));
  return haversineM(pLat, pLng, aLat + t * dy, aLng + t * dx);
}

/** Find the nearest road node to a given lat/lng. Returns null if none within maxDist. */
function findNearestNode(
  nodes: { id: string; latitude: number; longitude: number }[],
  lat: number,
  lng: number,
  maxDist = Infinity,
): { id: string; lat: number; lng: number; dist: number } | null {
  let best: { id: string; lat: number; lng: number; dist: number } | null = null;
  for (const n of nodes) {
    const d = haversineM(lat, lng, n.latitude, n.longitude);
    if (d < maxDist && (!best || d < best.dist)) {
      best = { id: n.id, lat: n.latitude, lng: n.longitude, dist: d };
    }
  }
  return best;
}

/**
 * Snap drawn coordinates to the nearest road nodes. For each coordinate:
 * - If a node is within SNAP_RADIUS, use that node
 * - Otherwise create a new RoadNode at the drawn position
 * Returns an ordered list of node ids (with duplicates removed for consecutive same-node snaps).
 */
async function snapCoordsToNodes(
  coords: number[][],
  existingNodes: { id: string; latitude: number; longitude: number }[],
): Promise<{ nodeIds: string[]; nodeMap: Map<string, { lat: number; lng: number }> }> {
  const SNAP_RADIUS = 100; // meters — snap to nearest node within this radius
  const nodeMap = new Map<string, { lat: number; lng: number }>();
  for (const n of existingNodes) nodeMap.set(n.id, { lat: n.latitude, lng: n.longitude });

  const orderedNodeIds: string[] = [];

  for (const [lng, lat] of coords) {
    const nearest = findNearestNode(existingNodes, lat, lng, SNAP_RADIUS);
    let nodeId: string;

    if (nearest) {
      nodeId = nearest.id;
    } else {
      // Create a new node at this position
      const newNode = await prisma.roadNode.create({
        data: { latitude: lat, longitude: lng, name: "" },
      });
      existingNodes.push(newNode); // add to pool for subsequent snapping
      nodeMap.set(newNode.id, { lat: newNode.latitude, lng: newNode.longitude });
      nodeId = newNode.id;
    }

    // Avoid consecutive duplicate nodes
    if (orderedNodeIds.length === 0 || orderedNodeIds[orderedNodeIds.length - 1] !== nodeId) {
      orderedNodeIds.push(nodeId);
    }
  }

  return { nodeIds: orderedNodeIds, nodeMap };
}

/**
 * Remove all infrastructure elements and road segments created by a project.
 * Called when a project is backtracked from finalizat.
 */
async function removeProjectInfrastructure(projectId: string) {
  const deleted = await prisma.infrastructureElement.deleteMany({
    where: { projectId },
  });
  if (deleted.count > 0) {
    console.log(`[Project ${projectId}] Removed ${deleted.count} infrastructure elements (backtrack)`);
  }
}

/**
 * When a project is finalized, snap its drawn geometry to road nodes,
 * create/upgrade road segments as bike_lane, and save infrastructure elements.
 */
async function applyProjectToRoadNetwork(project: any) {
  const coords = extractCoords(project.geometry);
  const projectType: string = project.projectType || "infrastructura_mixta";

  // ── Bike lane creation (for pista_biciclete, coridor_verde, infrastructura_mixta) ──
  if (["pista_biciclete", "coridor_verde", "infrastructura_mixta"].includes(projectType) && coords.length >= 2) {
    // Load all road nodes and segments
    const [nodes, segments] = await Promise.all([
      prisma.roadNode.findMany(),
      prisma.roadSegment.findMany(),
    ]);

    const nodeMap = new Map<string, { lat: number; lng: number }>();
    for (const n of nodes) nodeMap.set(n.id, { lat: n.latitude, lng: n.longitude });

    // ── Step 1: Upgrade existing nearby segments ──
    const MATCH_DISTANCE = 50;
    const segIdsToUpgrade: string[] = [];

    for (const seg of segments) {
      if (seg.roadType === "bike_lane") continue;
      const from = nodeMap.get(seg.fromNodeId);
      const to = nodeMap.get(seg.toNodeId);
      if (!from || !to) continue;

      const midLat = (from.lat + to.lat) / 2;
      const midLng = (from.lng + to.lng) / 2;

      let minDist = Infinity;
      for (let i = 0; i < coords.length - 1; i++) {
        const [aLng, aLat] = coords[i];
        const [bLng, bLat] = coords[i + 1];
        const d = pointToSegDist(midLat, midLng, aLat, aLng, bLat, bLng);
        if (d < minDist) minDist = d;
        if (minDist < MATCH_DISTANCE) break;
      }

      if (minDist < MATCH_DISTANCE) {
        segIdsToUpgrade.push(seg.id);
      }
    }

    if (segIdsToUpgrade.length > 0) {
      await prisma.roadSegment.updateMany({
        where: { id: { in: segIdsToUpgrade } },
        data: { roadType: "bike_lane", safetyScore: 85 },
      });
      console.log(`[Project ${project.id}] Upgraded ${segIdsToUpgrade.length} existing road segments to bike_lane`);
    }

    // ── Step 2: Snap drawn coords to nodes and create NEW segments ──
    const { nodeIds, nodeMap: updatedNodeMap } = await snapCoordsToNodes(coords, nodes);

    // Build a set of existing segment pairs (both directions) for dedup
    const existingPairs = new Set<string>();
    for (const seg of segments) {
      existingPairs.add(`${seg.fromNodeId}:${seg.toNodeId}`);
      existingPairs.add(`${seg.toNodeId}:${seg.fromNodeId}`);
    }

    const newSegmentIds: string[] = [];

    for (let i = 0; i < nodeIds.length - 1; i++) {
      const fromId = nodeIds[i];
      const toId = nodeIds[i + 1];
      if (fromId === toId) continue;

      // Check if this exact pair already has a segment
      const pairKey = `${fromId}:${toId}`;
      if (existingPairs.has(pairKey)) {
        // Upgrade the existing segment to bike_lane
        await prisma.roadSegment.updateMany({
          where: {
            OR: [
              { fromNodeId: fromId, toNodeId: toId },
              { fromNodeId: toId, toNodeId: fromId },
            ],
          },
          data: { roadType: "bike_lane", safetyScore: 85 },
        });
        continue;
      }

      const fromPos = updatedNodeMap.get(fromId)!;
      const toPos = updatedNodeMap.get(toId)!;
      const length = haversineM(fromPos.lat, fromPos.lng, toPos.lat, toPos.lng);

      const segGeometry = {
        type: "LineString",
        coordinates: [
          [fromPos.lng, fromPos.lat],
          [toPos.lng, toPos.lat],
        ],
      };

      const newSeg = await prisma.roadSegment.create({
        data: {
          fromNodeId: fromId,
          toNodeId: toId,
          name: project.title,
          length,
          roadType: "bike_lane",
          safetyScore: 85,
          geometry: segGeometry,
        },
      });

      newSegmentIds.push(newSeg.id);
      existingPairs.add(pairKey);
      existingPairs.add(`${toId}:${fromId}`);
    }

    console.log(`[Project ${project.id}] Created ${newSegmentIds.length} new bike_lane road segments`);

    // ── Step 3: Create infrastructure elements for ALL bike lane segments ──
    const bikeLayer = await prisma.infrastructureLayer.findFirst({
      where: { type: "pista_biciclete" },
    });

    if (bikeLayer) {
      // Create infra elements for upgraded existing segments
      if (segIdsToUpgrade.length > 0) {
        const upgraded = await prisma.roadSegment.findMany({
          where: { id: { in: segIdsToUpgrade } },
        });
        for (const seg of upgraded) {
          if (!seg.geometry) continue;
          await prisma.infrastructureElement.create({
            data: {
              layerId: bikeLayer.id,
              type: "pista_biciclete",
              typeLabel: "Pistă de biciclete",
              name: seg.name || project.title,
              geometry: seg.geometry as any,
              projectId: project.id,
              properties: { projectId: project.id },
            },
          });
        }
      }

      // Create infra elements for new segments
      if (newSegmentIds.length > 0) {
        const newSegs = await prisma.roadSegment.findMany({
          where: { id: { in: newSegmentIds } },
        });
        for (const seg of newSegs) {
          if (!seg.geometry) continue;
          await prisma.infrastructureElement.create({
            data: {
              layerId: bikeLayer.id,
              type: "pista_biciclete",
              typeLabel: "Pistă de biciclete",
              name: seg.name || project.title,
              geometry: seg.geometry as any,
              projectId: project.id,
              properties: { projectId: project.id },
            },
          });
        }
      }

      // Also create one full polyline infra element for the snapped path
      if (nodeIds.length >= 2) {
        const snappedCoords = nodeIds.map((id) => {
          const pos = updatedNodeMap.get(id)!;
          return [pos.lng, pos.lat];
        });
        await prisma.infrastructureElement.create({
          data: {
            layerId: bikeLayer.id,
            type: "pista_biciclete",
            typeLabel: "Pistă de biciclete",
            name: project.title,
            geometry: { type: "LineString", coordinates: snappedCoords },
            projectId: project.id,
            properties: { projectId: project.id, snapped: true },
          },
        });
      }
    }

    // ── Step 4: Update project geometry with snapped coordinates ──
    if (nodeIds.length >= 2) {
      const snappedCoords = nodeIds.map((id) => {
        const pos = updatedNodeMap.get(id)!;
        return [pos.lng, pos.lat];
      });
      const snappedGeometry = {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: { type: "LineString", coordinates: snappedCoords },
            properties: { name: project.title, type: projectType, snapped: true },
          },
        ],
      };
      await prisma.project.update({
        where: { id: project.id },
        data: { geometry: snappedGeometry },
      });
      console.log(`[Project ${project.id}] Updated project geometry with snapped coordinates`);
    }
  }

  // ── Semafoare (for semaforizare projects) ──
  if (projectType === "semaforizare" && coords.length >= 1) {
    const semaforLayer = await prisma.infrastructureLayer.findFirst({
      where: { type: "semafor" },
    });
    if (semaforLayer) {
      for (const [lng, lat] of coords) {
        await prisma.infrastructureElement.create({
          data: {
            layerId: semaforLayer.id,
            type: "semafor",
            typeLabel: "Semafor",
            name: project.title,
            geometry: { type: "Point", coordinates: [lng, lat] },
            projectId: project.id,
            properties: { projectId: project.id },
          },
        });
      }
      console.log(`[Project ${project.id}] Created ${coords.length} semafor elements`);
    }
  }

  // ── Bike parking (for parcare_biciclete projects) ──
  if (projectType === "parcare_biciclete" && coords.length >= 1) {
    const parkingLayer = await prisma.infrastructureLayer.findFirst({
      where: { type: "parcare_biciclete" },
    });
    if (parkingLayer) {
      for (const [lng, lat] of coords) {
        await prisma.infrastructureElement.create({
          data: {
            layerId: parkingLayer.id,
            type: "parcare_biciclete",
            typeLabel: "Parcare biciclete",
            name: project.title,
            geometry: { type: "Point", coordinates: [lng, lat] },
            projectId: project.id,
            properties: { projectId: project.id },
          },
        });
      }
      console.log(`[Project ${project.id}] Created ${coords.length} bike parking elements`);
    }
  }

  // ── Zona 30 (for zona_30 projects) ──
  if (projectType === "zona_30" && coords.length >= 2) {
    const zona30Layer = await prisma.infrastructureLayer.findFirst({
      where: { type: "zona_30" },
    });
    if (zona30Layer) {
      await prisma.infrastructureElement.create({
        data: {
          layerId: zona30Layer.id,
          type: "zona_30",
          typeLabel: "Zonă 30",
          name: project.title,
          geometry: { type: "LineString", coordinates: coords },
          projectId: project.id,
          properties: { projectId: project.id },
        },
      });
      console.log(`[Project ${project.id}] Created zona_30 infrastructure element`);
    }
  }

  // ── Zona pietonală (for zona_pietonala projects) ──
  if (projectType === "zona_pietonala" && coords.length >= 2) {
    const zonaPietLayer = await prisma.infrastructureLayer.findFirst({
      where: { type: "zona_pietonala" },
    });
    if (zonaPietLayer) {
      await prisma.infrastructureElement.create({
        data: {
          layerId: zonaPietLayer.id,
          type: "zona_pietonala",
          typeLabel: "Zonă pietonală",
          name: project.title,
          geometry: { type: "LineString", coordinates: coords },
          projectId: project.id,
          properties: { projectId: project.id },
        },
      });
      console.log(`[Project ${project.id}] Created zona_pietonala infrastructure element`);
    }
  }
}

export default router;