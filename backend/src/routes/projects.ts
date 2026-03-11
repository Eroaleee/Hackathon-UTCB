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
      stage: stage || "planificat",
      stageLabel: stageLabel || "Planificat",
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
        stage: "planificat",
        stageLabel: "Planificat",
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

export default router;