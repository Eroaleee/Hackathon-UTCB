import { Router, Request, Response } from "express";
import prisma from "../prisma";
import { requireAuth, requireAdmin, optionalAuth } from "../middleware/auth";
import { processUserAction, notifyUser } from "../services/gamification";
import { asyncHandler } from "../middleware/async-handler";

const router = Router();

/** GET /api/proposals — Public: list all proposals with vote counts */
router.get("/", asyncHandler(async (req: Request, res: Response) => {
  const { status, category } = req.query;
  const user = (req as any).user;

  const where: any = {};
  if (status) where.status = status;
  if (category) where.category = category;

  const proposals = await prisma.proposal.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { id: true, nickname: true, avatar: true, role: true } },
      votes: true,
      images: { select: { id: true, url: true } },
      _count: { select: { comments: true } },
      comments: {
        where: { parentId: null },
        include: {
          user: { select: { id: true, nickname: true, avatar: true, role: true } },
          replies: {
            include: {
              user: { select: { id: true, nickname: true, avatar: true, role: true } },
            },
          },
        },
        orderBy: { createdAt: "asc" },
        take: 5,
      },
    },
  });

  const result = proposals.map((p: any) => {
    const votesSum = p.votes.reduce((acc: number, v: any) => acc + v.direction, 0) + (p.anonymousVoteScore || 0);
    const userVote = user ? p.votes.find((v: any) => v.userId === user.id)?.direction ?? null : null;
    const { votes, ...rest } = p;
    return {
      ...rest,
      authorName: p.user.nickname,
      authorAvatar: p.user.avatar,
      authorRole: p.user.role,
      votes: votesSum,
      userVote: userVote === 1 ? "up" : userVote === -1 ? "down" : null,
      commentCount: p._count.comments,
    };
  });

  res.json(result);
}));

/** GET /api/proposals/:id — Public: single proposal with comments */
router.get("/:id", asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const user = (req as any).user;

  const proposal = await prisma.proposal.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, nickname: true, avatar: true, role: true } },
      votes: true,
      images: { select: { id: true, url: true } },
      comments: {
        where: { parentId: null },
        include: {
          user: { select: { id: true, nickname: true, avatar: true, role: true } },
          replies: {
            include: {
              user: { select: { id: true, nickname: true, avatar: true, role: true } },
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

  const votesSum = proposal.votes.reduce((acc: number, v: any) => acc + v.direction, 0) + (proposal.anonymousVoteScore || 0);
  const userVote = user ? proposal.votes.find((v: any) => v.userId === user.id)?.direction ?? null : null;
  const { votes, ...rest } = proposal;

  res.json({
    ...rest,
    authorName: proposal.user.nickname,
    authorAvatar: proposal.user.avatar,
    authorRole: proposal.user.role,
    votes: votesSum,
    userVote: userVote === 1 ? "up" : userVote === -1 ? "down" : null,
    commentCount: proposal.comments.length,
  });
}));

/** POST /api/proposals — Auth required: create a proposal */
router.post("/", requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { category, categoryLabel, title, description, latitude, longitude, address, images } = req.body;

  if (!category || !title || !description || latitude == null || longitude == null) {
    res.status(400).json({ error: "Câmpuri obligatorii lipsă." });
    return;
  }

  const resolvedAddress = address || `${parseFloat(latitude).toFixed(4)}, ${parseFloat(longitude).toFixed(4)}`;

  const proposal = await prisma.proposal.create({
    data: {
      userId: user.id,
      category,
      categoryLabel: categoryLabel || category,
      title,
      description,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      address: resolvedAddress,
      geometry: req.body.geometry || null,
      images: images?.length
        ? { create: images.map((url: string) => ({ url })) }
        : undefined,
    },
    include: { images: { select: { id: true, url: true } } },
  });

  // Gamification
  try {
    await processUserAction(user.id, "proposal", `A propus: ${title}`, `/cetatean/propuneri`);
  } catch { /* non-blocking */ }

  res.status(201).json(proposal);
}));

/** POST /api/proposals/:id/vote — vote on a proposal (auth or anonymous) */
router.post("/:id/vote", optionalAuth, asyncHandler(async (req: Request, res: Response) => {
  const proposalId = req.params.id as string;
  const user = (req as any).user;
  const { direction } = req.body; // "up" or "down"

  const dir = direction === "up" ? 1 : -1;

  if (!user) {
    // Anonymous vote – just adjust score
    await prisma.proposal.update({ where: { id: proposalId }, data: { anonymousVoteScore: { increment: dir } } });
    res.json({ userVote: direction });
    return;
  }

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

  // Gamification for voter + notify proposal author
  try {
    await processUserAction(user.id, "vote", `A votat o propunere`, `/cetatean/propuneri`);
    const proposal = await prisma.proposal.findUnique({ where: { id: proposalId }, select: { userId: true, title: true } });
    if (proposal && proposal.userId !== user.id) {
      await notifyUser(proposal.userId, "proposal_vote", "Vot nou pe propunerea ta", `Cineva a votat propunerea "${proposal.title}".`, `/cetatean/propuneri`);
    }
  } catch { /* non-blocking */ }

  res.json({ userVote: direction });
}));

/** PATCH /api/proposals/:id — Admin: update proposal status */
router.patch("/:id", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
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
}));

export default router;
