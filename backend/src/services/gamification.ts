/**
 * Gamification Service — Awards badges, logs activities, sends notifications.
 */
import prisma from "../prisma";

type ActionType = "report" | "proposal" | "vote" | "comment";

const BADGE_RULES: {
  name: string;
  action: ActionType;
  threshold: number;
  countField: string;
}[] = [
  { name: "Primul Raport", action: "report", threshold: 1, countField: "reports" },
  { name: "Explorator Urban", action: "report", threshold: 5, countField: "reports" },
  { name: "Campion al Pistelor", action: "report", threshold: 20, countField: "reports" },
  { name: "Prima Propunere", action: "proposal", threshold: 1, countField: "proposals" },
  { name: "Votant Activ", action: "vote", threshold: 10, countField: "votes" },
  { name: "Comentator", action: "comment", threshold: 5, countField: "comments" },
];

const XP_REWARDS: Record<ActionType, number> = {
  report: 15,
  proposal: 25,
  vote: 5,
  comment: 10,
};

const LEVEL_THRESHOLDS = [0, 50, 150, 300, 600, 1000];
const LEVEL_NAMES = ["Începător", "Biciclist Activ", "Activist Urban", "Campion Civic", "Legendă Urbană"];

export { LEVEL_THRESHOLDS, LEVEL_NAMES };

/**
 * Award XP, check badges, log activity, and send notifications for a user action.
 */
export async function processUserAction(
  userId: string,
  action: ActionType,
  description: string,
  link?: string
) {
  // 1. Award XP
  const xpGain = XP_REWARDS[action];
  const user = await prisma.user.update({
    where: { id: userId },
    data: { xp: { increment: xpGain } },
  });

  // 2. Update level
  const newXp = user.xp;
  let newLevel = 0;
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (newXp >= LEVEL_THRESHOLDS[i]) { newLevel = i; break; }
  }
  const newLevelName = LEVEL_NAMES[Math.min(newLevel, LEVEL_NAMES.length - 1)];
  if (newLevel !== user.level) {
    await prisma.user.update({
      where: { id: userId },
      data: { level: newLevel, levelName: newLevelName },
    });
  }

  // 3. Log activity
  await prisma.activity.create({
    data: { userId, type: action, description, link },
  });

  // 4. Check and award badges
  const counts: Record<string, number> = {};
  if (action === "report" || !counts.reports) {
    counts.reports = await prisma.report.count({ where: { userId } });
  }
  if (action === "proposal" || !counts.proposals) {
    counts.proposals = await prisma.proposal.count({ where: { userId } });
  }
  if (action === "vote" || !counts.votes) {
    counts.votes = await prisma.proposalVote.count({ where: { userId } });
  }
  if (action === "comment" || !counts.comments) {
    counts.comments = await prisma.comment.count({ where: { userId } });
  }

  const existingBadges = await prisma.userBadge.findMany({
    where: { userId },
    include: { badge: true },
  });
  const earnedNames = new Set(existingBadges.map((ub) => ub.badge.name));

  for (const rule of BADGE_RULES) {
    if (earnedNames.has(rule.name)) continue;
    if (rule.action === action && counts[rule.countField] >= rule.threshold) {
      const badge = await prisma.badge.findUnique({ where: { name: rule.name } });
      if (badge) {
        await prisma.userBadge.create({
          data: { userId, badgeId: badge.id },
        });
        // Notify about badge
        await prisma.notification.create({
          data: {
            userId,
            type: "badge_earned",
            title: "Insignă nouă!",
            message: `Ai câștigat insigna "${badge.name}": ${badge.description}`,
            link: "/cetatean/profil",
          },
        });
      }
    }
  }

  return { xpGain, newLevel, newLevelName };
}

/**
 * Send notification to a specific user.
 */
export async function notifyUser(
  userId: string,
  type: "report_update" | "proposal_vote" | "project_update" | "badge_earned" | "system",
  title: string,
  message: string,
  link?: string
) {
  await prisma.notification.create({
    data: { userId, type, title, message, link },
  });
}

/**
 * Notify all followers of a project about an update.
 */
export async function notifyProjectFollowers(
  projectId: string,
  title: string,
  message: string
) {
  const followers = await prisma.projectFollow.findMany({
    where: { projectId },
    select: { userId: true },
  });
  if (followers.length === 0) return;
  await prisma.notification.createMany({
    data: followers.map((f) => ({
      userId: f.userId,
      type: "project_update" as const,
      title,
      message,
      link: `/cetatean/proiecte`,
    })),
  });
}
