"use client";

import { motion } from "framer-motion";
import {
  FileText,
  ThumbsUp,
  FolderOpen,
  Star,
  TrendingUp,
  MapPin,
  Clock,
  Award,
} from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  PageTransition,
  StaggerContainer,
  StaggerItem,
} from "@/components/ui/page-transition";
import { proposalStatusConfig } from "@/lib/mock-data";
import {
  useCurrentUser,
  useCitizenStats,
  useActivities,
  useProjects,
  useProposals,
  useBadges,
} from "@/lib/api";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";

const xpForNextLevel = 1500;

export default function CetateanHomePage() {
  const { data: currentUser } = useCurrentUser();
  const { data: citizenStats } = useCitizenStats();
  const { data: activities } = useActivities();
  const { data: projects } = useProjects();
  const { data: proposals } = useProposals();
  const { data: badges } = useBadges();

  const stats = citizenStats ?? { reportsSubmitted: 0, proposalsVoted: 0, activeProjects: 0, pointsEarned: 0 };

  const statCards = [
    {
      label: "Rapoarte trimise",
      value: stats.reportsSubmitted,
      icon: FileText,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "Propuneri votate",
      value: stats.proposalsVoted,
      icon: ThumbsUp,
      color: "text-accent",
      bg: "bg-accent/10",
    },
    {
      label: "Proiecte în desfășurare",
      value: stats.activeProjects,
      icon: FolderOpen,
      color: "text-warning",
      bg: "bg-warning/10",
    },
    {
      label: "Puncte câștigate",
      value: stats.pointsEarned,
      icon: Star,
      color: "text-yellow-400",
      bg: "bg-yellow-400/10",
    },
  ];
  return (
    <PageTransition>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Greeting */}
        <div>
          <h1 className="text-2xl font-bold font-[family-name:var(--font-heading)]">
            Bună ziua, {currentUser?.name?.split(" ")[0] || "Utilizator"}! 👋
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Ai {stats.reportsSubmitted} rapoarte active. Continuă să contribui la
            îmbunătățirea orașului!
          </p>
        </div>

        {/* Stats Row */}
        <StaggerContainer className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat) => (
            <StaggerItem key={stat.label}>
              <GlassCard hover className="flex items-center gap-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.bg}`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold font-[family-name:var(--font-heading)]">
                    <AnimatedCounter value={stat.value} />
                  </p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </GlassCard>
            </StaggerItem>
          ))}
        </StaggerContainer>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Recent Activity */}
            <GlassCard>
              <div className="flex items-center gap-2 mb-4">
                <Clock className="h-4 w-4 text-primary" />
                <h2 className="text-lg font-semibold font-[family-name:var(--font-heading)]">
                  Activitate recentă
                </h2>
              </div>
              <div className="space-y-3">
                {(activities ?? []).slice(0, 5).map((activity, i) => (
                  <motion.div
                    key={activity.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 * i }}
                    className="flex items-start gap-3 p-2 rounded-lg hover:bg-surface-light/50 transition-colors"
                  >
                    <div className="mt-0.5 h-2 w-2 rounded-full bg-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm">{activity.description}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(activity.createdAt).toLocaleDateString("ro-RO", {
                          day: "numeric",
                          month: "long",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </GlassCard>

            {/* Trending Proposals */}
            <GlassCard>
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="h-4 w-4 text-accent" />
                <h2 className="text-lg font-semibold font-[family-name:var(--font-heading)]">
                  Trending propuneri
                </h2>
              </div>
              <div className="space-y-3">
                {(proposals ?? [])
                  .sort((a, b) => b.votes - a.votes)
                  .slice(0, 3)
                  .map((proposal, i) => (
                    <motion.div
                      key={proposal.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15 * i }}
                      className="flex items-start justify-between p-3 rounded-lg bg-surface-light/30 hover:bg-surface-light/50 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium truncate">{proposal.title}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge
                            label={proposalStatusConfig[proposal.status].label}
                            colorClass={proposalStatusConfig[proposal.status].color}
                          />
                          <span className="text-xs text-muted-foreground">
                            de {proposal.authorName}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 ml-3">
                        <ThumbsUp className="h-3.5 w-3.5 text-primary" />
                        <span className="text-sm font-bold text-primary">{proposal.votes}</span>
                      </div>
                    </motion.div>
                  ))}
              </div>
            </GlassCard>
          </div>

          {/* Right column */}
          <div className="space-y-6">
            {/* Proiecte aproape de tine */}
            <GlassCard>
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="h-4 w-4 text-warning" />
                <h2 className="text-lg font-semibold font-[family-name:var(--font-heading)]">
                  Proiecte aproape de tine
                </h2>
              </div>
              <div className="space-y-3">
                {(projects ?? []).slice(0, 3).map((project) => (
                  <div
                    key={project.id}
                    className="p-3 rounded-lg bg-surface-light/30 hover:bg-surface-light/50 transition-colors cursor-pointer"
                  >
                    <p className="text-sm font-medium">{project.title}</p>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {project.description}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-primary font-medium">
                        📍 {project.address}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>

            {/* Gamification */}
            <GlassCard glowing>
              <div className="flex items-center gap-2 mb-4">
                <Award className="h-4 w-4 text-yellow-400" />
                <h2 className="text-lg font-semibold font-[family-name:var(--font-heading)]">
                  Progresul tău
                </h2>
              </div>

              <div className="text-center mb-4">
                <p className="text-sm text-muted-foreground">Nivel {currentUser?.level ?? 0}</p>
                <p className="text-lg font-bold text-accent">{currentUser?.levelName ?? "Începător"}</p>
              </div>

              {/* XP Bar */}
              <div className="mb-4">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>{currentUser?.xp ?? 0} XP</span>
                  <span>{xpForNextLevel} XP</span>
                </div>
                <div className="h-2 rounded-full bg-surface-light overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${((currentUser?.xp ?? 0) / xpForNextLevel) * 100}%` }}
                    transition={{ duration: 1, delay: 0.5, ease: "easeOut" }}
                    className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Încă {xpForNextLevel - (currentUser?.xp ?? 0)} XP până la nivelul următor
                </p>
              </div>

              {/* Badges */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Insigne</p>
                <div className="grid grid-cols-3 gap-2">
                  {(currentUser?.badges ?? badges ?? []).map((badge) => (
                    <div
                      key={badge.id}
                      className={`flex flex-col items-center p-2 rounded-lg text-center ${
                        badge.earned
                          ? "bg-primary/10 border border-primary/20"
                          : "bg-surface-light/30 opacity-40"
                      }`}
                    >
                      <span className="text-xl">{badge.icon}</span>
                      <span className="text-[10px] mt-1 leading-tight">{badge.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </GlassCard>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
