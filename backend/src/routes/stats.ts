import { Router, Request, Response } from "express";
import prisma from "../prisma";

const router = Router();

/** GET /api/stats/dashboard — Public: aggregated dashboard numbers */
router.get("/dashboard", async (req: Request, res: Response) => {
  const [
    totalReports,
    resolvedReports,
    pendingReports,
    todayReports,
    totalProposals,
    activeProjects,
    activeUsers,
  ] = await Promise.all([
    prisma.report.count(),
    prisma.report.count({ where: { status: "rezolvat" } }),
    prisma.report.count({ where: { status: { in: ["trimis", "in_analiza"] } } }),
    prisma.report.count({
      where: {
        createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
    }),
    prisma.proposal.count(),
    prisma.project.count({ where: { stage: { in: ["in_lucru", "consultare_publica", "aprobare"] } } }),
    prisma.user.count({ where: { role: "cetatean" } }),
  ]);

  res.json({
    totalReports,
    resolvedReports,
    pendingReports,
    averageResolutionTime: "4.2 zile",
    totalProposals,
    activeProjects,
    activeUsers,
    todayReports,
  });
});

/** GET /api/stats/citizen — Public (with optional auth): per-user stats */
router.get("/citizen", async (req: Request, res: Response) => {
  const user = (req as any).user;

  if (!user) {
    res.json({ reportsSubmitted: 0, proposalsVoted: 0, activeProjects: 0, pointsEarned: 0 });
    return;
  }

  const [reportsSubmitted, proposalsVoted, activeProjects] = await Promise.all([
    prisma.report.count({ where: { userId: user.id } }),
    prisma.proposalVote.count({ where: { userId: user.id } }),
    prisma.projectFollow.count({ where: { userId: user.id } }),
  ]);

  res.json({
    reportsSubmitted,
    proposalsVoted,
    activeProjects,
    pointsEarned: user.xp,
  });
});

/** GET /api/stats/reports-by-category — Public */
router.get("/reports-by-category", async (req: Request, res: Response) => {
  const groups = await prisma.report.groupBy({
    by: ["category"],
    _count: { id: true },
  });

  const labelMap: Record<string, string> = {
    masini_parcate: "Mașini parcate",
    gropi: "Gropi",
    constructii: "Construcții",
    drum_blocat: "Drum blocat",
    interferenta_pietoni: "Pietoni",
    obstacole: "Obstacole",
    parcari_biciclete: "Parcări",
    iluminat: "Iluminat",
    altele: "Altele",
  };

  const result = groups.map((g: any) => ({
    name: labelMap[g.category] || g.category,
    value: g._count.id,
  }));

  res.json(result);
});

/** GET /api/stats/proposals-by-status — Public */
router.get("/proposals-by-status", async (req: Request, res: Response) => {
  const groups = await prisma.proposal.groupBy({
    by: ["status"],
    _count: { id: true },
  });

  const colorMap: Record<string, { name: string; fill: string }> = {
    in_analiza: { name: "În analiză", fill: "#00d4ff" },
    aprobat: { name: "Aprobate", fill: "#a3e635" },
    respins: { name: "Respinse", fill: "#ef4444" },
    in_implementare: { name: "În implementare", fill: "#f59e0b" },
  };

  const result = groups.map((g: any) => ({
    name: colorMap[g.status]?.name || g.status,
    value: g._count.id,
    fill: colorMap[g.status]?.fill || "#888",
  }));

  res.json(result);
});

/** GET /api/stats/reports-over-time — Public: monthly report trend (last 12 months) */
router.get("/reports-over-time", async (req: Request, res: Response) => {
  const monthNames = ["Ian", "Feb", "Mar", "Apr", "Mai", "Iun", "Iul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const now = new Date();

  const result = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);

    const [rapoarte, rezolvate] = await Promise.all([
      prisma.report.count({ where: { createdAt: { gte: start, lt: end } } }),
      prisma.report.count({ where: { createdAt: { gte: start, lt: end }, status: "rezolvat" } }),
    ]);

    result.push({ name: monthNames[d.getMonth()], rapoarte, rezolvate });
  }

  res.json(result);
});

/** GET /api/stats/heatmap — Public: daily activity counts for the past year */
router.get("/heatmap", async (req: Request, res: Response) => {
  const now = new Date();
  const oneYearAgo = new Date(now);
  oneYearAgo.setFullYear(now.getFullYear() - 1);

  // Get all reports from the past year grouped by day
  const reports = await prisma.report.findMany({
    where: { createdAt: { gte: oneYearAgo } },
    select: { createdAt: true },
  });

  // Build a map of date -> count
  const countMap: Record<string, number> = {};
  for (const r of reports) {
    const dateStr = r.createdAt.toISOString().split("T")[0];
    countMap[dateStr] = (countMap[dateStr] || 0) + 1;
  }

  // Generate all days in the range
  const result = [];
  const current = new Date(oneYearAgo);
  while (current <= now) {
    const dateStr = current.toISOString().split("T")[0];
    result.push({ date: dateStr, count: countMap[dateStr] || 0 });
    current.setDate(current.getDate() + 1);
  }

  res.json(result);
});

export default router;
