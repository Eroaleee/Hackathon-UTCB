import { Router, Request, Response } from "express";
import prisma from "../prisma";
import { requireAuth } from "../middleware/auth";

const router = Router();

/** GET /api/projects — Public: list all projects with like/follow counts */
router.get("/", async (req: Request, res: Response) => {
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
    },
  });

  const result = projects.map((p: any) => ({
    ...p,
    followers: p._count.followers,
    likes: p._count.likes,
    commentCount: p._count.comments,
    isFollowing: user ? (p.followers as any[]).length > 0 : false,
    isLiked: user ? (p.likes as any[]).length > 0 : false,
  }));

  res.json(result);
});

/** GET /api/projects/:id — Public: single project with comments */
router.get("/:id", async (req: Request, res: Response) => {
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
    likes: project._count.likes,
    commentCount: project._count.comments,
    isFollowing: user ? (project.followers as any[]).length > 0 : false,
    isLiked: user ? (project.likes as any[]).length > 0 : false,
  });
});

/** POST /api/projects/:id/like — Auth required: toggle like */
router.post("/:id/like", requireAuth, async (req: Request, res: Response) => {
  const projectId = req.params.id as string;
  const user = (req as any).user;

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
});

/** POST /api/projects/:id/follow — Auth required: toggle follow */
router.post("/:id/follow", requireAuth, async (req: Request, res: Response) => {
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
});

export default router;
