"use client";

import { motion } from "framer-motion";
import {
  User,
  MapPin,
  Calendar,
  FileText,
  Lightbulb,
  ThumbsUp,
  MessageCircle,
  Settings,
  Award,
  Camera,
} from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  PageTransition,
  StaggerContainer,
  StaggerItem,
} from "@/components/ui/page-transition";
import {
  currentUser,
  mockBadges,
  mockReports,
  mockCitizenStats,
  reportStatusConfig,
} from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const xpForNextLevel = 1500;

const levelNames = [
  "Începător",
  "Biciclist Activ",
  "Activist Urban",
  "Campion Civic",
  "Legendă Urbană",
];

const activityStats = [
  { label: "Rapoarte", value: mockCitizenStats.reportsSubmitted, icon: FileText, color: "text-primary" },
  { label: "Propuneri", value: 3, icon: Lightbulb, color: "text-accent" },
  { label: "Voturi", value: mockCitizenStats.proposalsVoted, icon: ThumbsUp, color: "text-warning" },
  { label: "Comentarii", value: 12, icon: MessageCircle, color: "text-purple-400" },
];

const userReports = mockReports.filter((r) => r.userId === currentUser.id);

export default function ProfilPage() {
  return (
    <PageTransition>
      <div className="max-w-4xl mx-auto">
        {/* Profile header */}
        <GlassCard className="mb-6" glowing>
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {/* Avatar */}
            <div className="relative group">
              <div className="h-24 w-24 rounded-2xl bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center text-3xl font-bold text-primary border-2 border-primary/20">
                {currentUser.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </div>
              <button className="absolute inset-0 rounded-2xl bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera className="h-6 w-6 text-white" />
              </button>
            </div>

            {/* Info */}
            <div className="flex-1 text-center sm:text-left">
              <h1 className="text-2xl font-bold font-[family-name:var(--font-heading)]">
                {currentUser.name}
              </h1>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {currentUser.neighborhood}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  Membru din{" "}
                  {new Date(currentUser.joinedAt).toLocaleDateString("ro-RO", {
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>
              <div className="flex items-center justify-center sm:justify-start gap-2 mt-3">
                <StatusBadge
                  label={`Nivel ${currentUser.level} — ${currentUser.levelName}`}
                  colorClass="bg-primary/20 text-primary border-primary/30"
                />
                <StatusBadge
                  label={`${currentUser.xp} XP`}
                  colorClass="bg-accent/20 text-accent border-accent/30"
                />
              </div>
            </div>

            <button className="shrink-0 rounded-lg p-2 hover:bg-surface-light transition-colors text-muted-foreground hover:text-foreground">
              <Settings className="h-5 w-5" />
            </button>
          </div>
        </GlassCard>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Activity stats */}
            <StaggerContainer className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {activityStats.map((stat) => (
                <StaggerItem key={stat.label}>
                  <GlassCard className="text-center">
                    <stat.icon className={cn("h-5 w-5 mx-auto mb-1", stat.color)} />
                    <p className="text-xl font-bold font-[family-name:var(--font-heading)]">
                      <AnimatedCounter value={stat.value} />
                    </p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </GlassCard>
                </StaggerItem>
              ))}
            </StaggerContainer>

            {/* My reports */}
            <GlassCard>
              <h2 className="text-lg font-semibold font-[family-name:var(--font-heading)] mb-4 flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Rapoartele mele
              </h2>
              <div className="space-y-2">
                {userReports.map((report, i) => (
                  <motion.div
                    key={report.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 * i }}
                    className="flex items-center justify-between p-3 rounded-lg bg-surface-light/30 hover:bg-surface-light/50 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{report.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">
                          📍 {report.address}
                        </span>
                      </div>
                    </div>
                    <StatusBadge
                      label={reportStatusConfig[report.status].label}
                      colorClass={reportStatusConfig[report.status].color}
                    />
                  </motion.div>
                ))}
              </div>
            </GlassCard>
          </div>

          {/* Right column — Gamification */}
          <div className="space-y-6">
            {/* Level progress */}
            <GlassCard glowing>
              <div className="flex items-center gap-2 mb-4">
                <Award className="h-4 w-4 text-yellow-400" />
                <h2 className="text-lg font-semibold font-[family-name:var(--font-heading)]">
                  Gamificare
                </h2>
              </div>

              {/* Level indicator */}
              <div className="text-center mb-4">
                <div className="inline-flex items-center gap-1 mb-2">
                  {levelNames.map((name, i) => (
                    <div
                      key={name}
                      className={cn(
                        "h-2 flex-1 rounded-full min-w-[24px]",
                        i <= currentUser.level
                          ? "bg-gradient-to-r from-primary to-accent"
                          : "bg-surface-light"
                      )}
                    />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {currentUser.levelName} → {levelNames[currentUser.level + 1] || "Max"}
                </p>
              </div>

              {/* XP Bar */}
              <div className="mb-6">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>{currentUser.xp} XP</span>
                  <span>{xpForNextLevel} XP</span>
                </div>
                <div className="h-3 rounded-full bg-surface-light overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(currentUser.xp / xpForNextLevel) * 100}%` }}
                    transition={{ duration: 1, delay: 0.5, ease: "easeOut" }}
                    className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1 text-center">
                  Încă {xpForNextLevel - currentUser.xp} XP până la nivelul următor
                </p>
              </div>

              {/* Badges */}
              <div>
                <p className="text-sm font-medium mb-3">Insigne obținute</p>
                <div className="grid grid-cols-2 gap-2">
                  {mockBadges.map((badge) => (
                    <motion.div
                      key={badge.id}
                      whileHover={badge.earned ? { scale: 1.05 } : {}}
                      className={cn(
                        "flex flex-col items-center p-3 rounded-xl text-center border transition-all",
                        badge.earned
                          ? "border-primary/20 bg-primary/5 cursor-pointer"
                          : "border-border bg-surface-light/20 opacity-40"
                      )}
                    >
                      <span className="text-2xl mb-1">{badge.icon}</span>
                      <span className="text-xs font-medium">{badge.name}</span>
                      <span className="text-[10px] text-muted-foreground mt-0.5">
                        {badge.earned
                          ? `Obținut ${new Date(badge.earnedAt!).toLocaleDateString("ro-RO")}`
                          : badge.description}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </div>
            </GlassCard>

            {/* Settings */}
            <GlassCard>
              <h2 className="text-lg font-semibold font-[family-name:var(--font-heading)] mb-4 flex items-center gap-2">
                <Settings className="h-4 w-4 text-muted-foreground" />
                Setări
              </h2>
              <div className="space-y-3">
                {[
                  "Notificări push",
                  "Actualizări email",
                  "Rapoarte din zona mea",
                ].map((setting) => (
                  <label
                    key={setting}
                    className="flex items-center justify-between cursor-pointer"
                  >
                    <span className="text-sm">{setting}</span>
                    <div className="relative">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="h-5 w-9 rounded-full bg-surface-light peer-checked:bg-primary transition-colors" />
                      <div className="absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-4" />
                    </div>
                  </label>
                ))}
              </div>
            </GlassCard>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
