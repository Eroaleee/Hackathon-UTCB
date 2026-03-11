import { Router, Request, Response } from "express";
import prisma from "../prisma";
import { requireAuth, requireAdmin } from "../middleware/auth";

const router = Router();

/** GET /api/proposals — Public: list all proposals with vote counts */
router.get("/", async (req: Request, res: Response) => {
  const { status, category } = req.query;
  const user = (req as any).user;

  const where: any = {};
  if (status) where.status = status;
  if (category) where.category = category;

  const proposals = await prisma.proposal.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { id: true, nickname: true, avatar: true } },
      votes: true,
      images: { select: { id: true, url: true } },
      _count: { select: { comments: true } },
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

  const result = proposals.map((p: any) => {
    const votesSum = p.votes.reduce((acc: number, v: any) => acc + v.direction, 0);
    const userVote = user ? p.votes.find((v: any) => v.userId === user.id)?.direction ?? null : null;
    const { votes, ...rest } = p;
    return {
      ...rest,
      authorName: p.user.nickname,
      authorAvatar: p.user.avatar,
      votes: votesSum,
      userVote: userVote === 1 ? "up" : userVote === -1 ? "down" : null,
      commentCount: p._count.comments,
    };
  });

  res.json(result);
});

/** GET /api/proposals/:id — Public: single proposal with comments */
router.get("/:id", async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const user = (req as any).user;

  const proposal = await prisma.proposal.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, nickname: true, avatar: true } },
      votes: true,
      images: { select: { id: true, url: true } },
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

  if (!proposal) {
    res.status(404).json({ error: "Propunerea nu a fost găsită." });
    return;
  }

  const votesSum = proposal.votes.reduce((acc: number, v: any) => acc + v.direction, 0);
  const userVote = user ? proposal.votes.find((v: any) => v.userId === user.id)?.direction ?? null : null;
  const { votes, ...rest } = proposal;

  res.json({
    ...rest,
    authorName: proposal.user.nickname,
    authorAvatar: proposal.user.avatar,
    votes: votesSum,
    userVote: userVote === 1 ? "up" : userVote === -1 ? "down" : null,
    commentCount: proposal.comments.length,
  });
});

/** POST /api/proposals — Auth required: create a proposal */
router.post("/", requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { category, categoryLabel, title, description, latitude, longitude, address, images } = req.body;

  if (!category || !title || !description || latitude == null || longitude == null || !address) {
    res.status(400).json({ error: "Câmpuri obligatorii lipsă." });
    return;
  }

  const proposal = await prisma.proposal.create({
    data: {
      userId: user.id,
      category,
      categoryLabel: categoryLabel || category,
      title,
      description,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      address,
      images: images?.length
        ? { create: images.map((url: string) => ({ url })) }
        : undefined,
    },
    include: { images: { select: { id: true, url: true } } },
  });

  res.status(201).json(proposal);
});

/** POST /api/proposals/:id/vote — Auth required: vote on a proposal */
router.post("/:id/vote", requireAuth, async (req: Request, res: Response) => {
  const proposalId = req.params.id as string;
  const user = (req as any).user;
  const { direction } = req.body; // "up" or "down"

  const dir = direction === "up" ? 1 : -1;

  const existing = await prisma.proposalVote.findUnique({
    where: { userId_proposalId: { userId: user.id, proposalId } },
  });

  if (existing) {
    if (existing.direction === dir) {
      // Remove vote
      await prisma.proposalVote.delete({ where: { id: existing.id } });
      res.json({ userVote: null });
      return;
    }
    // Change vote
    await prisma.proposalVote.update({ where: { id: existing.id }, data: { direction: dir } });
    res.json({ userVote: direction });
    return;
  }

  await prisma.proposalVote.create({
    data: { userId: user.id, proposalId, direction: dir },
  });

  res.json({ userVote: direction });
});

/** PATCH /api/proposals/:id — Admin: update proposal status */
router.patch("/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { status } = req.body;

  if (!status) {
    res.status(400).json({ error: "Câmpul 'status' este obligatoriu." });
    return;
  }

  const proposal = await prisma.proposal.update({
    where: { id },
    data: { status },
    include: {
      user: { select: { id: true, nickname: true, avatar: true } },
      images: { select: { id: true, url: true } },
      _count: { select: { comments: true } },
    },
  });

  res.json(proposal);
});

export default router;
