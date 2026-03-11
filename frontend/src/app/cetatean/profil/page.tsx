"use client";

import { useState, useEffect } from "react";
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
  LogIn,
  Save,
  Check,
  X,
  Lock,
} from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { BadgeIcon } from "@/components/ui/badge-icon";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  PageTransition,
  StaggerContainer,
  StaggerItem,
} from "@/components/ui/page-transition";
import {
  reportStatusConfig,
} from "@/lib/mock-data";
import {
  useCurrentUser,
  useBadges,
  useReports,
  useCitizenStats,
  apiPatch,
  LEVEL_THRESHOLDS,
  LEVEL_NAMES,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import Link from "next/link";

export default function ProfilPage() {
  const { user: authUser } = useAuth();
  const { data: currentUser, mutate: mutateUser } = useCurrentUser();
  const { data: badges } = useBadges();
  const { data: reports } = useReports();
  const { data: citizenStats } = useCitizenStats();

  // Settings state
  const [showSettings, setShowSettings] = useState(false);
  const [editNickname, setEditNickname] = useState("");
  const [editNeighborhood, setEditNeighborhood] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  // Notification preferences (localStorage)
  const [pushNotif, setPushNotif] = useState(true);
  const [emailUpdates, setEmailUpdates] = useState(true);
  const [localReports, setLocalReports] = useState(true);

  // Password change
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Load settings from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      setPushNotif(localStorage.getItem("vc_push_notif") !== "false");
      setEmailUpdates(localStorage.getItem("vc_email_updates") !== "false");
      setLocalReports(localStorage.getItem("vc_local_reports") !== "false");
    }
  }, []);

  // Sync edit fields when user data loads
  useEffect(() => {
    if (currentUser) {
      setEditNickname(currentUser.name || "");
      setEditNeighborhood(currentUser.neighborhood || "");
    }
  }, [currentUser]);

  const toggleSetting = (key: string, value: boolean, setter: (v: boolean) => void) => {
    setter(value);
    localStorage.setItem(key, String(value));
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      await apiPatch("/auth/settings", {
        nickname: editNickname,
        neighborhood: editNeighborhood,
      });
      mutateUser();
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2000);
    } catch {
      // Ignore
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      setPasswordMsg({ ok: false, text: "Minimum 6 caractere." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ ok: false, text: "Parolele nu coincid." });
      return;
    }
    setSavingPassword(true);
    setPasswordMsg(null);
    try {
      await apiPatch("/auth/password", { newPassword, confirmPassword });
      setPasswordMsg({ ok: true, text: "Parola a fost schimbată!" });
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPasswordMsg(null), 3000);
    } catch {
      setPasswordMsg({ ok: false, text: "Eroare la schimbarea parolei." });
    } finally {
      setSavingPassword(false);
    }
  };

  if (!authUser) {
    return (
      <PageTransition>
        <div className="max-w-md mx-auto mt-20 text-center">
          <GlassCard className="p-8">
            <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-bold font-[family-name:var(--font-heading)] mb-2">
              Profilul necesită autentificare
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Conectează-te sau creează un cont pentru a vedea profilul tău, statisticile și insignele.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/20 text-primary hover:bg-primary/30 transition-colors font-medium text-sm"
            >
              <LogIn className="h-4 w-4" /> Conectează-te
            </Link>
          </GlassCard>
        </div>
      </PageTransition>
    );
  }

  const stats = citizenStats ?? { reportsSubmitted: 0, proposalsVoted: 0, activeProjects: 0, pointsEarned: 0, proposalsSubmitted: 0, commentsCount: 0 };

  const activityStats = [
    { label: "Rapoarte", value: stats.reportsSubmitted, icon: FileText, color: "text-primary" },
    { label: "Propuneri", value: stats.proposalsSubmitted, icon: Lightbulb, color: "text-accent" },
    { label: "Voturi", value: stats.proposalsVoted, icon: ThumbsUp, color: "text-warning" },
    { label: "Comentarii", value: stats.commentsCount, icon: MessageCircle, color: "text-purple-400" },
  ];

  const userReports = (reports ?? []).filter((r) => r.userId === currentUser?.id);
  // Merge badges: use useBadges (all badges) as base, enrich with earnedAt from user
  const earnedMap = new Map(
    (currentUser?.badges ?? []).map((b) => [b.id, b.earnedAt])
  );
  const allBadges = (badges ?? []).map((b) => ({
    ...b,
    earned: b.earned || earnedMap.has(b.id),
    earnedAt: earnedMap.get(b.id) ?? b.earnedAt,
  }));
  return (
    <PageTransition>
      <div className="max-w-4xl mx-auto">
        {/* Profile header */}
        <GlassCard className="mb-6" glowing>
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6">
            {/* Avatar */}
            <div className="relative group">
              <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-2xl bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center text-2xl sm:text-3xl font-bold text-primary border-2 border-primary/20">
                {(currentUser?.name || "")
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
                {currentUser?.name || "Utilizator"}
              </h1>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {currentUser?.neighborhood || ""}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  Membru din{" "}
                  {new Date(currentUser?.joinedAt || "").toLocaleDateString("ro-RO", {
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>
              <div className="flex items-center justify-center sm:justify-start gap-2 mt-3">
                <StatusBadge
                  label={`Nivel ${currentUser?.level ?? 0} — ${currentUser?.levelName ?? "Începător"}`}
                  colorClass="bg-primary/20 text-primary border-primary/30"
                />
                <StatusBadge
                  label={`${currentUser?.xp ?? 0} XP`}
                  colorClass="bg-accent/20 text-accent border-accent/30"
                />
              </div>
            </div>

            <button
              onClick={() => setShowSettings(true)}
              className="shrink-0 rounded-lg p-2 hover:bg-surface-light transition-colors text-muted-foreground hover:text-foreground"
            >
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
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {report.address}
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
                  Progresul tău
                </h2>
              </div>

              {/* Level indicator */}
              {(() => {
                const userLevel = currentUser?.level ?? 0;
                const currentLevelXp = LEVEL_THRESHOLDS[userLevel] ?? 0;
                const nextLevelXp = LEVEL_THRESHOLDS[Math.min(userLevel + 1, LEVEL_THRESHOLDS.length - 1)] ?? 1000;
                const xp = currentUser?.xp ?? 0;
                const xpInLevel = xp - currentLevelXp;
                const xpNeeded = nextLevelXp - currentLevelXp || 1;
                const progress = userLevel >= LEVEL_THRESHOLDS.length - 1 ? 100 : Math.min(100, (xpInLevel / xpNeeded) * 100);
                const isMax = userLevel >= LEVEL_NAMES.length - 1;
                return (
                  <>
                    <div className="text-center mb-4">
                      <div className="inline-flex items-center gap-1 mb-2 w-full">
                        {LEVEL_NAMES.map((name, i) => (
                          <div
                            key={name}
                            className={cn(
                              "h-2 flex-1 rounded-full min-w-[24px]",
                              i <= userLevel
                                ? "bg-gradient-to-r from-primary to-accent"
                                : "bg-surface-light"
                            )}
                          />
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {currentUser?.levelName ?? "Începător"} → {isMax ? "Max" : LEVEL_NAMES[userLevel + 1]}
                      </p>
                    </div>

                    {/* XP Bar */}
                    <div className="mb-6">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>{xp} XP</span>
                        <span>{isMax ? "MAX" : `${nextLevelXp} XP`}</span>
                      </div>
                      <div className="h-3 rounded-full bg-surface-light overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${progress}%` }}
                          transition={{ duration: 1, delay: 0.5, ease: "easeOut" }}
                          className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 text-center">
                        {isMax ? "Nivel maxim atins!" : `Încă ${nextLevelXp - xp} XP până la nivelul următor`}
                      </p>
                    </div>
                  </>
                );
              })()}

              {/* Badges */}
              <div>
                <p className="text-sm font-medium mb-3">Insigne obținute</p>
                <div className="grid grid-cols-2 gap-2">
                  {allBadges.map((badge) => (
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
                      <BadgeIcon name={badge.icon} className="h-6 w-6 mb-1" />
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

            {/* Settings popup trigger */}
            <div onClick={() => setShowSettings(true)} className="cursor-pointer">
            <GlassCard className="hover:border-primary/30 transition-colors">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold font-[family-name:var(--font-heading)] flex items-center gap-2">
                  <Settings className="h-4 w-4 text-muted-foreground" />
                  Setări
                </h2>
                <span className="text-xs text-muted-foreground">Apasă pentru a edita →</span>
              </div>
            </GlassCard>
            </div>

            {/* Settings popup modal */}
            {showSettings && (
              <div className="fixed top-14 left-0 right-0 bottom-0 z-[1050] flex items-center justify-center p-4" onClick={() => setShowSettings(false)}>
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  onClick={(e) => e.stopPropagation()}
                  className="relative w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-2xl"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="text-lg font-bold font-[family-name:var(--font-heading)] flex items-center gap-2">
                      <Settings className="h-5 w-5 text-primary" />
                      Setări profil
                    </h2>
                    <button onClick={() => setShowSettings(false)} className="rounded-lg p-1.5 hover:bg-surface-light transition-colors">
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  {/* Profile fields */}
                  <div className="space-y-4 mb-6">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Nume</label>
                      <Input
                        value={editNickname}
                        onChange={(e) => setEditNickname(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Cartier</label>
                      <Input
                        value={editNeighborhood}
                        onChange={(e) => setEditNeighborhood(e.target.value)}
                      />
                    </div>
                    <Button
                      onClick={handleSaveProfile}
                      disabled={savingProfile}
                      className="w-full flex items-center justify-center gap-2"
                    >
                      {profileSaved ? (
                        <><Check className="h-4 w-4" /> Salvat!</>
                      ) : (
                        <><Save className="h-4 w-4" /> {savingProfile ? "Se salvează..." : "Salvează profilul"}</>
                      )}
                    </Button>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-border mb-4" />

                  {/* Password change */}
                  <p className="text-sm font-medium mb-3 flex items-center gap-2">
                    <Lock className="h-4 w-4" /> Schimbă parola
                  </p>
                  <div className="space-y-3 mb-6">
                    <Input
                      type="password"
                      placeholder="Parola nouă"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                    <Input
                      type="password"
                      placeholder="Confirmă parola nouă"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                    {passwordMsg && (
                      <p className={cn("text-xs", passwordMsg.ok ? "text-green-400" : "text-red-400")}>
                        {passwordMsg.text}
                      </p>
                    )}
                    <Button
                      onClick={handleChangePassword}
                      disabled={savingPassword || !newPassword || !confirmPassword}
                      variant="outline"
                      className="w-full"
                    >
                      {savingPassword ? "Se salvează..." : "Schimbă parola"}
                    </Button>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-border mb-4" />

                  {/* Notification toggles */}
                  <p className="text-sm font-medium mb-3">Notificări</p>
                  <div className="space-y-3">
                    {[
                      { label: "Notificări push", key: "vc_push_notif", checked: pushNotif, setter: setPushNotif },
                      { label: "Actualizări email", key: "vc_email_updates", checked: emailUpdates, setter: setEmailUpdates },
                      { label: "Rapoarte din zona mea", key: "vc_local_reports", checked: localReports, setter: setLocalReports },
                    ].map((setting) => (
                      <label
                        key={setting.label}
                        className="flex items-center justify-between cursor-pointer"
                      >
                        <span className="text-sm">{setting.label}</span>
                        <div className="relative">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={setting.checked}
                            onChange={(e) => toggleSetting(setting.key, e.target.checked, setting.setter)}
                          />
                          <div className="h-5 w-9 rounded-full bg-surface-light peer-checked:bg-primary transition-colors" />
                          <div className="absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-4" />
                        </div>
                      </label>
                    ))}
                  </div>
                </motion.div>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
