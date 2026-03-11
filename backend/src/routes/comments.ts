import { Router, Request, Response } from "express";
import prisma from "../prisma";
import { requireAuth } from "../middleware/auth";
import { processUserAction } from "../services/gamification";
import { asyncHandler } from "../middleware/async-handler";

const router = Router();

/** POST /api/comments — Auth required: create a comment on a proposal or project */
router.post("/", requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { proposalId, projectId, parentId, content } = req.body;

  if (!content || typeof content !== "string" || content.trim().length === 0) {
    res.status(400).json({ error: "Conținutul comentariului este obligatoriu." });
    return;
  }

  if (!proposalId && !projectId) {
    res.status(400).json({ error: "Trebuie specificat proposalId sau projectId." });
    return;
  }

  const comment = await prisma.comment.create({
    data: {
      userId: user.id,
      proposalId: proposalId || null,
      projectId: projectId || null,
      parentId: parentId || null,
      content: content.trim(),
    },
    include: {
      user: { select: { id: true, nickname: true, avatar: true, role: true } },
    },
  });

  // Gamification
  try {
    await processUserAction(user.id, "comment", `A comentat`, proposalId ? `/cetatean/propuneri` : `/cetatean/proiecte`);
  } catch { /* non-blocking */ }

  res.status(201).json(comment);
}));

/** GET /api/comments?proposalId=...&projectId=... — Public: get comments */
router.get("/", asyncHandler(async (req: Request, res: Response) => {
  const { proposalId, projectId } = req.query;

  const where: any = { parentId: null };
  if (proposalId) where.proposalId = proposalId;
  if (projectId) where.projectId = projectId;

  const comments = await prisma.comment.findMany({
    where,
    include: {
      user: { select: { id: true, nickname: true, avatar: true, role: true } },
      replies: {
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
    orderBy: { createdAt: "asc" },
  });

  res.json(comments);
}));

export default router;
