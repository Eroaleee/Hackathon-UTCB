"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  FileText,
  CheckCircle2,
  Clock,
  Users,
  TrendingUp,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { PageTransition, StaggerContainer, StaggerItem } from "@/components/ui/page-transition";
import {
  useDashboardStats,
  useReportsByCategory,
  useReportsOverTime,
  useProposalsByStatus,
  useHeatmapData,
} from "@/lib/api";

const PIE_COLORS = ["#00d4ff", "#a3e635", "#ef4444", "#f59e0b"];

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-lg p-3 border border-border text-sm">
      <p className="text-muted-foreground mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} style={{ color: entry.color }}>
          {entry.name}: {entry.value.toLocaleString()}
        </p>
      ))}
    </div>
  );
};

export default function AdminStatisticsPage() {
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "12m" | "tot">("tot");
  const { data: dashboardStats } = useDashboardStats();
  const { data: reportsByCategoryData } = useReportsByCategory();
  const { data: reportsOverTimeData } = useReportsOverTime();
  const { data: proposalsByStatusData } = useProposalsByStatus();
  const { data: heatmapCalendarData } = useHeatmapData();

  const stats = dashboardStats ?? {
    totalReports: 0,
    resolvedReports: 0,
    pendingReports: 0,
    averageResolutionTime: "—",
    totalProposals: 0,
    activeProjects: 0,
    activeUsers: 0,
    todayReports: 0,
    trends: { totalReports: 0, resolvedReports: 0, pendingReports: 0, activeUsers: 0 },
  };

  const formatTrend = (value: number) => {
    const sign = value >= 0 ? "+" : "";
    return `${sign}${value}%`;
  };

  const kpiCards = [
    {
      title: "Total rapoarte",
      value: stats.totalReports,
      icon: FileText,
      color: "text-primary",
      bgColor: "bg-primary/10",
      trend: formatTrend(stats.trends.totalReports),
      trendUp: stats.trends.totalReports >= 0,
    },
    {
      title: "Rapoarte rezolvate",
      value: stats.resolvedReports,
      icon: CheckCircle2,
      color: "text-accent",
      bgColor: "bg-accent/10",
      trend: formatTrend(stats.trends.resolvedReports),
      trendUp: stats.trends.resolvedReports >= 0,
    },
    {
      title: "În așteptare",
      value: stats.pendingReports,
      icon: Clock,
      color: "text-warning",
      bgColor: "bg-warning/10",
      trend: formatTrend(stats.trends.pendingReports),
      trendUp: stats.trends.pendingReports <= 0,
    },
    {
      title: "Utilizatori activi",
      value: stats.activeUsers,
      icon: Users,
      color: "text-primary",
      bgColor: "bg-primary/10",
      trend: formatTrend(stats.trends.activeUsers),
      trendUp: stats.trends.activeUsers >= 0,
    },
  ];

  const reportsByCategory = reportsByCategoryData ?? [];
  const reportsOverTime = reportsOverTimeData ?? [];
  const proposalsByStatus = proposalsByStatusData ?? [];

  // Group calendar data into weeks for display
  const calendarData = heatmapCalendarData ?? [];
  const weeks: { date: string; count: number }[][] = [];
  for (let i = 0; i < calendarData.length; i += 7) {
    weeks.push(calendarData.slice(i, i + 7));
  }

  return (
    <PageTransition>
      <div className="max-w-[1400px] mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3 sm:gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold font-[family-name:var(--font-heading)]">
              Statistici & Analiză
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Monitorizare în timp real a platformei
            </p>
          </div>
          <div className="flex items-center gap-1 glass rounded-lg p-1">
            {(["7d", "30d", "12m", "tot"] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  timeRange === range
                    ? "bg-warning/20 text-warning"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {range === "7d" ? "7 zile" : range === "30d" ? "30 zile" : range === "12m" ? "12 luni" : "Tot"}
              </button>
            ))}
          </div>
        </div>

        {/* KPI Row */}
        <StaggerContainer className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {kpiCards.map((card) => (
            <StaggerItem key={card.title}>
              <GlassCard className="p-3 sm:p-4">
                <div className="flex items-center justify-between mb-2 sm:mb-3">
                  <div className={`p-1.5 sm:p-2 rounded-lg ${card.bgColor}`}>
                    <card.icon className={`h-4 w-4 sm:h-5 sm:w-5 ${card.color}`} />
                  </div>
                  <div
                    className={`flex items-center gap-1 text-xs font-medium ${
                      card.trendUp ? "text-accent" : "text-destructive"
                    }`}
                  >
                    {card.trendUp ? (
                      <ArrowUpRight className="h-3 w-3" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3" />
                    )}
                    {card.trend}
                  </div>
                </div>
                <div className="text-xl sm:text-2xl font-bold font-[family-name:var(--font-heading)]">
                  <AnimatedCounter value={card.value} />
                </div>
                <p className="text-[11px] sm:text-xs text-muted-foreground mt-1 truncate">{card.title}</p>
              </GlassCard>
            </StaggerItem>
          ))}
        </StaggerContainer>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
          {/* Area Chart - Reports Over Time */}
          <GlassCard className="lg:col-span-2 p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold">Rapoarte în timp</h3>
                <p className="text-xs text-muted-foreground">
                  Rapoarte trimise vs. rezolvate
                </p>
              </div>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={reportsOverTime}>
                  <defs>
                    <linearGradient id="colorRapoarte" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00d4ff" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#00d4ff" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorRezolvate" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a3e635" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#a3e635" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="rapoarte"
                    name="Rapoarte"
                    stroke="#00d4ff"
                    fill="url(#colorRapoarte)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="rezolvate"
                    name="Rezolvate"
                    stroke="#a3e635"
                    fill="url(#colorRezolvate)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>

          {/* Pie Chart - Proposals by Status */}
          <GlassCard className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold">Propuneri pe status</h3>
                <p className="text-xs text-muted-foreground">Distribuție curentă</p>
              </div>
            </div>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={proposalsByStatus}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {proposalsByStatus.map((entry, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0];
                      return (
                        <div className="glass rounded-lg p-2 border border-border text-xs">
                          <p style={{ color: d.payload.fill }}>{d.name}: {String(d.value)}</p>
                        </div>
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 mt-2">
              {proposalsByStatus.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: item.fill }}
                    />
                    <span className="text-muted-foreground">{item.name}</span>
                  </div>
                  <span className="font-medium">{item.value}</span>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
          {/* Bar Chart - Reports by Category */}
          <GlassCard className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold">Rapoarte pe categorie</h3>
                <p className="text-xs text-muted-foreground">Top categorii de probleme</p>
              </div>
            </div>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={reportsByCategory} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                  <XAxis type="number" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fill: "#71717a", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={100}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" name="Rapoarte" fill="#00d4ff" radius={[0, 4, 4, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>

          {/* Heatmap Calendar */}
          <GlassCard className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold">Calendar activitate</h3>
                <p className="text-xs text-muted-foreground">Rapoarte trimise pe zi</p>
              </div>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="overflow-x-auto">
              <div className="flex gap-[3px] min-w-[700px]">
                {weeks.slice(0, 52).map((week, wi) => (
                  <div key={wi} className="flex flex-col gap-[3px]">
                    {week.map((day, di) => {
                      const intensity = Math.min(day.count / 14, 1);
                      return (
                        <motion.div
                          key={di}
                          className="h-[11px] w-[11px] rounded-sm cursor-pointer"
                          style={{
                            backgroundColor:
                              day.count === 0
                                ? "rgba(255,255,255,0.04)"
                                : `rgba(0, 212, 255, ${0.15 + intensity * 0.85})`,
                          }}
                          whileHover={{ scale: 1.6 }}
                          title={`${day.date}: ${day.count} rapoarte`}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-1.5 mt-3 text-[10px] text-muted-foreground justify-end">
                <span>Mai puțin</span>
                {[0, 0.25, 0.5, 0.75, 1].map((v) => (
                  <div
                    key={v}
                    className="h-[11px] w-[11px] rounded-sm"
                    style={{
                      backgroundColor:
                        v === 0 ? "rgba(255,255,255,0.04)" : `rgba(0, 212, 255, ${0.15 + v * 0.85})`,
                    }}
                  />
                ))}
                <span>Mai mult</span>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Quick Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <GlassCard className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-warning/10 flex items-center justify-center">
              <Clock className="h-6 w-6 text-warning" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Timp mediu de rezolvare</p>
              <p className="text-lg font-bold font-[family-name:var(--font-heading)]">
                {stats.averageResolutionTime}
              </p>
            </div>
          </GlassCard>
          <GlassCard className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-accent/10 flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-accent" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Rapoarte azi</p>
              <p className="text-lg font-bold font-[family-name:var(--font-heading)]">
                <AnimatedCounter value={stats.todayReports} />
              </p>
            </div>
          </GlassCard>
          <GlassCard className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total propuneri</p>
              <p className="text-lg font-bold font-[family-name:var(--font-heading)]">
                <AnimatedCounter value={stats.totalProposals} />
              </p>
            </div>
          </GlassCard>
        </div>
      </div>
    </PageTransition>
  );
}
