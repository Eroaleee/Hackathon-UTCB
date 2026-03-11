"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import {
  Play,
  Pause,
  RotateCcw,
  Download,
  ChevronRight,
  Shield,
  MapPin,
  AlertTriangle,
  Accessibility,
} from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { PageTransition } from "@/components/ui/page-transition";
import { useSimulations, useSimulationBaseline } from "@/lib/api";
import type { SimulationScenario } from "@/types";

const SimMap = dynamic<{
  variant: "current" | "future";
  scenarioId?: string;
}>(() => import("@/app/admin/simulare/sim-map").then((mod) => mod.default), {
  ssr: false,
});

const metricConfig: {
  key: keyof SimulationScenario["metrics"];
  label: string;
  icon: typeof Shield;
  color: string;
  suffix: string;
}[] = [
  { key: "safetyScore", label: "Siguranță", icon: Shield, color: "#a3e635", suffix: "/100" },
  { key: "coveragePercent", label: "Acoperire", icon: MapPin, color: "#00d4ff", suffix: "%" },
  { key: "conflictZones", label: "Zone conflict", icon: AlertTriangle, color: "#f59e0b", suffix: "" },
  { key: "accessibilityScore", label: "Accesibilitate", icon: Accessibility, color: "#a855f7", suffix: "/100" },
];

export default function AdminSimulationPage() {
  const { data: scenarios } = useSimulations();
  const { data: baselineData } = useSimulationBaseline();
  const allScenarios = scenarios ?? [];
  const [activeScenario, setActiveScenario] = useState<SimulationScenario | null>(null);
  const [playing, setPlaying] = useState(false);
  const [timelineValue, setTimelineValue] = useState(50);

  // Set default when data arrives
  if (allScenarios.length > 0 && !activeScenario) {
    setActiveScenario(allScenarios[0]);
  }

  // Baseline metrics from API (current state)
  const baseline = baselineData ?? { safetyScore: 0, coveragePercent: 0, conflictZones: 0, accessibilityScore: 0 };

  return (
    <PageTransition>
      <div className="min-h-[calc(100vh-3.5rem-2rem)] sm:min-h-[calc(100vh-3.5rem-3rem)] flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold font-[family-name:var(--font-heading)]">
              Simulare infrastructură
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Compară scenarii de dezvoltare a infrastructurii pentru biciclete
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => { /* PDF export placeholder */ }}>
            <Download className="h-4 w-4 mr-1" /> Export PDF
          </Button>
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0">
          {/* Controls Panel */}
          <div className="w-full lg:w-72 shrink-0 flex flex-col gap-4">
            {/* Scenario Presets */}
            <GlassCard className="p-3">
              <p className="text-xs text-muted-foreground font-medium mb-2">Scenarii predefinite</p>
              <div className="space-y-1.5">
                {allScenarios.map((sc) => (
                  <button
                    key={sc.id}
                    onClick={() => setActiveScenario(sc)}
                    className={`w-full text-left p-2.5 rounded-lg text-xs transition-all ${
                      activeScenario?.id === sc.id
                        ? "bg-warning/10 border border-warning/30 text-warning"
                        : "hover:bg-surface-light text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <p className="font-medium">{sc.name}</p>
                    <p className="text-[10px] mt-0.5 opacity-70">{sc.description}</p>
                  </button>
                ))}
              </div>
            </GlassCard>

            {/* Metrics Comparison */}
            <GlassCard className="p-3 flex-1">
              <p className="text-xs text-muted-foreground font-medium mb-3">Metrici</p>
              <div className="space-y-4">
                {metricConfig.map((m) => {
                  const current = baseline[m.key];
                  const future = activeScenario?.metrics[m.key] ?? 0;
                  const improved = m.key === "conflictZones" ? future < current : future > current;
                  return (
                    <div key={m.key}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <div className="flex items-center gap-1.5">
                          <m.icon className="h-3.5 w-3.5" style={{ color: m.color }} />
                          <span className="text-muted-foreground">{m.label}</span>
                        </div>
                        <span className={improved ? "text-accent" : "text-destructive"}>
                          {current} <ChevronRight className="inline h-3 w-3" /> {future}{m.suffix}
                        </span>
                      </div>
                      <div className="flex gap-1 h-2">
                        {/* Current bar */}
                        <div className="flex-1 bg-surface-light rounded-full overflow-hidden">
                          <motion.div
                            className="h-full rounded-full opacity-50"
                            style={{ backgroundColor: m.color }}
                            initial={{ width: 0 }}
                            animate={{
                              width: `${m.key === "conflictZones" ? Math.min(current * 3, 100) : current}%`,
                            }}
                            transition={{ duration: 0.8 }}
                          />
                        </div>
                        {/* Future bar */}
                        <div className="flex-1 bg-surface-light rounded-full overflow-hidden">
                          <motion.div
                            className="h-full rounded-full"
                            style={{ backgroundColor: m.color }}
                            initial={{ width: 0 }}
                            animate={{
                              width: `${m.key === "conflictZones" ? Math.min(future * 3, 100) : future}%`,
                            }}
                            transition={{ duration: 0.8, delay: 0.2 }}
                          />
                        </div>
                      </div>
                      <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                        <span>Acum</span>
                        <span>Scenariu</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </GlassCard>

            {/* Playback Controls */}
            <GlassCard className="p-3">
              <div className="flex items-center gap-2">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setPlaying(!playing)}
                  className="h-8 w-8"
                >
                  {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => { setTimelineValue(0); setPlaying(false); }}
                  className="h-8 w-8"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={timelineValue}
                  onChange={(e) => setTimelineValue(Number(e.target.value))}
                  className="flex-1 accent-warning h-1"
                />
                <span className="text-xs text-muted-foreground w-10 text-right">
                  {timelineValue}%
                </span>
              </div>
            </GlassCard>
          </div>

          {/* Split Map Area */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2 min-h-[300px] sm:min-h-[400px]">
            {/* Current State */}
            <div className="rounded-xl overflow-hidden border border-border relative">
              <div className="absolute top-3 left-3 z-[1000] glass rounded-lg px-3 py-1.5 text-xs font-medium flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Situația curentă
              </div>
              <SimMap variant="current" />
            </div>
            {/* Future State */}
            <div className="rounded-xl overflow-hidden border border-border relative">
              <div className="absolute top-3 left-3 z-[1000] glass rounded-lg px-3 py-1.5 text-xs font-medium flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-green-500" /> Scenariu: {activeScenario?.name ?? "—"}
              </div>
              <SimMap variant="future" scenarioId={activeScenario?.id} />
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
