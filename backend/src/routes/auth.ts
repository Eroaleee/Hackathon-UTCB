import { Router, Request, Response } from "express";
import { asyncHandler } from "../middleware/async-handler";
import bcrypt from "bcryptjs";
import prisma from "../prisma";
import { LEVEL_THRESHOLDS, LEVEL_NAMES } from "../services/gamification";

const router = Router();

/**
 * POST /api/auth/register — Register a citizen account.
 * Requires nickname, email, and password.
 */
router.post("/register", async (req: Request, res: Response) => {
  const { nickname, email, password, neighborhood } = req.body;

  if (!nickname || typeof nickname !== "string" || nickname.trim().length < 2) {
    res.status(400).json({ error: "Nickname-ul trebuie să aibă minimum 2 caractere." });
    return;
  }

  if (!email || typeof email !== "string" || !email.includes("@")) {
    res.status(400).json({ error: "Adresa de email este obligatorie." });
    return;
  }

  if (!password || typeof password !== "string" || password.length < 6) {
    res.status(400).json({ error: "Parola trebuie să aibă minimum 6 caractere." });
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ error: "Există deja un cont cu această adresă de email." });
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      nickname: nickname.trim(),
      email,
      password: hashedPassword,
      neighborhood: neighborhood || null,
    },
    select: {
      id: true,
      nickname: true,
      email: true,
      role: true,
      sessionToken: true,
      xp: true,
      level: true,
      levelName: true,
      neighborhood: true,
      createdAt: true,
    },
  });

  res.status(201).json(user);
});

/**
 * POST /api/auth/login — Login with email + password (required for admin, optional for citizens).
 * Returns user info + sessionToken.
 */
router.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: "Email și parola sunt obligatorii." });
    return;
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.password) {
    res.status(401).json({ error: "Email sau parolă incorectă." });
    return;
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    res.status(401).json({ error: "Email sau parolă incorectă." });
    return;
  }

  res.json({
    id: user.id,
    nickname: user.nickname,
    email: user.email,
    role: user.role,
    sessionToken: user.sessionToken,
    xp: user.xp,
    level: user.level,
    levelName: user.levelName,
    neighborhood: user.neighborhood,
    createdAt: user.createdAt,
  });
});

/**
 * GET /api/auth/me — Get current user info from session token.
 */
router.get("/me", async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) {
    res.status(401).json({ error: "Nu ești autentificat." });
    return;
  }

  const full = await prisma.user.findUnique({
    where: { id: user.id },
    include: {
      badges: { include: { badge: true } },
    },
  });

  if (!full) {
    res.status(404).json({ error: "Utilizator negăsit." });
    return;
  }

  // Recalculate level from XP on every request to keep it in sync
  let correctLevel = 0;
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (full.xp >= LEVEL_THRESHOLDS[i]) { correctLevel = i; break; }
  }
  const correctLevelName = LEVEL_NAMES[Math.min(correctLevel, LEVEL_NAMES.length - 1)];
  if (full.level !== correctLevel || full.levelName !== correctLevelName) {
    await prisma.user.update({
      where: { id: full.id },
      data: { level: correctLevel, levelName: correctLevelName },
    });
    full.level = correctLevel;
    full.levelName = correctLevelName;
  }

  res.json(full);
});

/** Badge definitions — auto-created if missing from DB */
const BADGE_DEFS = [
  { name: "Primul Raport", description: "Ai trimis primul raport de incidente", icon: "📢", countField: "reports" as const, threshold: 1 },
  { name: "Explorator Urban", description: "Ai raportat 5 incidente", icon: "🗺️", countField: "reports" as const, threshold: 5 },
  { name: "Campion al Pistelor", description: "20 de rapoarte", icon: "🏆", countField: "reports" as const, threshold: 20 },
  { name: "Prima Propunere", description: "Ai creat prima propunere de infrastructură", icon: "💡", countField: "proposals" as const, threshold: 1 },
  { name: "Votant Activ", description: "Ai votat pentru 10 propuneri", icon: "🗳️", countField: "votes" as const, threshold: 10 },
  { name: "Comentator", description: "Ai scris 5 comentarii", icon: "💬", countField: "comments" as const, threshold: 5 },
];

/** Ensure all badge definitions exist in DB, return the full list */
async function ensureBadges() {
  let badges = await prisma.badge.findMany({ orderBy: { createdAt: "asc" } });
  if (badges.length < BADGE_DEFS.length) {
    const existing = new Set(badges.map((b) => b.name));
    for (const def of BADGE_DEFS) {
      if (!existing.has(def.name)) {
        const created = await prisma.badge.create({
          data: { name: def.name, description: def.description, icon: def.icon },
        });
        badges.push(created);
      }
    }
  }
  return badges;
}

/** GET /api/auth/badges — Return all badges with earned status for current user */
router.get("/badges", async (req: Request, res: Response) => {
  const user = (req as any).user;
  const allBadges = await ensureBadges();

  let earnedBadgeIds = new Set<string>();
  const earnedAtMap = new Map<string, Date>();

  if (user) {
    // Count actual user activity
    const counts = {
      reports: await prisma.report.count({ where: { userId: user.id } }),
      proposals: await prisma.proposal.count({ where: { userId: user.id } }),
      votes: await prisma.proposalVote.count({ where: { userId: user.id } }),
      comments: await prisma.comment.count({ where: { userId: user.id } }),
    };

    const existingUB = await prisma.userBadge.findMany({
      where: { userId: user.id },
      select: { badgeId: true, earnedAt: true },
    });
    earnedBadgeIds = new Set(existingUB.map((ub) => ub.badgeId));
    for (const ub of existingUB) {
      earnedAtMap.set(ub.badgeId, ub.earnedAt);
    }

    // Award any badges the user qualifies for but doesn't have yet
    for (const def of BADGE_DEFS) {
      if (counts[def.countField] >= def.threshold) {
        const badge = allBadges.find((b) => b.name === def.name);
        if (badge && !earnedBadgeIds.has(badge.id)) {
          await prisma.userBadge.create({ data: { userId: user.id, badgeId: badge.id } });
          earnedBadgeIds.add(badge.id);
          earnedAtMap.set(badge.id, new Date());
        }
      }
    }
  }

  const result = allBadges.map((b) => ({
    id: b.id,
    name: b.name,
    description: b.description,
    icon: b.icon,
    earned: earnedBadgeIds.has(b.id),
    earnedAt: earnedAtMap.get(b.id) ?? null,
  }));

  res.json(result);
});

/** PATCH /api/auth/settings — Update user profile settings */
router.patch("/settings", async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) {
    res.status(401).json({ error: "Nu ești autentificat." });
    return;
  }

  const { nickname, neighborhood } = req.body;
  const updateData: any = {};
  if (nickname && typeof nickname === "string" && nickname.trim().length >= 2) {
    updateData.nickname = nickname.trim();
  }
  if (neighborhood !== undefined) {
    updateData.neighborhood = neighborhood || null;
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: updateData,
    select: { id: true, nickname: true, neighborhood: true },
  });

  res.json(updated);
});

/** PATCH /api/auth/password — Change password (new + confirm, no old password required) */
router.patch("/password", async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) {
    res.status(401).json({ error: "Nu ești autentificat." });
    return;
  }

  const { newPassword, confirmPassword } = req.body;
  if (!newPassword || typeof newPassword !== "string" || newPassword.length < 6) {
    res.status(400).json({ error: "Parola nouă trebuie să aibă minimum 6 caractere." });
    return;
  }
  if (newPassword !== confirmPassword) {
    res.status(400).json({ error: "Parolele nu coincid." });
    return;
  }

  const hashed = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashed },
  });

  res.json({ success: true });
});

/** POST /api/auth/logout — Invalidate session (regenerate token) */
router.post("/logout", async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) { res.json({ success: true }); return; }
  // Regenerate session token so the old one is invalid
  const crypto = await import("crypto");
  await prisma.user.update({
    where: { id: user.id },
    data: { sessionToken: crypto.randomUUID() },
  });
  res.json({ success: true });
});

export default router;