"use client";

import { useState, useCallback, useMemo } from "react";
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
  Plus,
  Trash2,
  RefreshCw,
  FolderOpen,
  FileDown,
  ArrowRight,
  Gauge,
} from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { PageTransition } from "@/components/ui/page-transition";
import {
  useSimulations,
  useSimulationBaseline,
  useProjects,
  createScenario,
  deleteScenario,
  runScenario,
  apiPatch,
} from "@/lib/api";
import { projectStageConfig, projectTypeLabels } from "@/lib/mock-data";
import type { SimulationScenario, Project } from "@/types";

const SimMap = dynamic<{
  variant: "current" | "future";
  scenarioChanges?: any;
  projectGeometry?: any;
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
  { key: "safetyScore", label: "Siguranță (40%)", icon: Shield, color: "#a3e635", suffix: "/100" },
  { key: "coveragePercent", label: "Acoperire (35%)", icon: MapPin, color: "#00d4ff", suffix: "%" },
  { key: "conflictZones", label: "Zone conflict", icon: AlertTriangle, color: "#f59e0b", suffix: "" },
  { key: "accessibilityScore", label: "Accesibilitate (25%)", icon: Accessibility, color: "#a855f7", suffix: "/100" },
];

/** Compute an improvement rating label + color based on VeloScore delta */
function getImprovementRating(delta: number): { label: string; emoji: string; color: string } {
  if (delta >= 20) return { label: "Schimbare excelentă", emoji: "🟢", color: "#10b981" };
  if (delta >= 10) return { label: "Îmbunătățire foarte bună", emoji: "🟢", color: "#22c55e" };
  if (delta >= 5) return { label: "Îmbunătățire bună", emoji: "🟡", color: "#84cc16" };
  if (delta >= 1) return { label: "Îmbunătățire minoră", emoji: "🟡", color: "#eab308" };
  if (delta === 0) return { label: "Fără schimbare", emoji: "⚪", color: "#9ca3af" };
  if (delta >= -5) return { label: "Regres ușor", emoji: "🟠", color: "#f97316" };
  return { label: "Schimbare negativă", emoji: "🔴", color: "#ef4444" };
}

export default function AdminSimulationPage() {
  const { data: scenarios, mutate: mutateScenarios } = useSimulations();
  const { data: baselineData } = useSimulationBaseline();
  const { data: apiProjects, mutate: mutateProjects } = useProjects();

  const allScenarios = scenarios ?? [];
  const projects = apiProjects ?? [];

  // Only projects in simulare or proiectare stage
  const eligibleProjects = useMemo(
    () => projects.filter((p) => ["simulare", "proiectare"].includes(p.stage)),
    [projects]
  );

  const [activeScenario, setActiveScenario] = useState<SimulationScenario | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [timelineValue, setTimelineValue] = useState(50);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [runningId, setRunningId] = useState<string | null>(null);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) || null,
    [projects, selectedProjectId]
  );

  // IDs of eligible projects for quick lookup
  const eligibleProjectIds = useMemo(
    () => new Set(eligibleProjects.map((p) => p.id)),
    [eligibleProjects]
  );

  // Only show scenarios linked to eligible projects (or with no project)
  const visibleScenarios = useMemo(
    () => allScenarios.filter((s) => !s.projectId || eligibleProjectIds.has(s.projectId)),
    [allScenarios, eligibleProjectIds]
  );

  // Filter scenarios by selected project
  const filteredScenarios = useMemo(() => {
    if (!selectedProjectId) return visibleScenarios;
    return visibleScenarios.filter((s) => s.projectId === selectedProjectId);
  }, [visibleScenarios, selectedProjectId]);

  // Set default when data arrives
  if (filteredScenarios.length > 0 && !activeScenario) {
    setActiveScenario(filteredScenarios[0]);
  }

  const baseline = baselineData ?? { safetyScore: 0, coveragePercent: 0, conflictZones: 0, accessibilityScore: 0, veloScore: 0 };

  const handleCreate = useCallback(async () => {
    const name = newName.trim() || (selectedProject ? `Simulare: ${selectedProject.title}` : "");
    if (!name) return;
    try {
      const created = await createScenario({
        name,
        ...(selectedProjectId ? { projectId: selectedProjectId } as any : {}),
      });
      await mutateScenarios();
      setActiveScenario(created);
      setNewName("");
      setCreating(false);
    } catch (e) {
      console.error("Failed to create scenario", e);
    }
  }, [newName, selectedProjectId, selectedProject, mutateScenarios]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteScenario(id);
      await mutateScenarios();
      if (activeScenario?.id === id) setActiveScenario(null);
    } catch (e) {
      console.error("Failed to delete scenario", e);
    }
  }, [activeScenario, mutateScenarios]);

  const handleRerun = useCallback(async (id: string) => {
    setRunningId(id);
    try {
      const updated = await runScenario(id);
      await mutateScenarios();
      setActiveScenario(updated);
    } catch (e) {
      console.error("Failed to rerun scenario", e);
    } finally {
      setRunningId(null);
    }
  }, [mutateScenarios]);

  // Export scenario result as GeoJSON
  const handleExportGeoJSON = () => {
    if (!activeScenario) return;
    const data = JSON.stringify({
      type: "FeatureCollection",
      features: activeScenario.changes?.features || [],
      properties: {
        scenarioName: activeScenario.name,
        metrics: activeScenario.metrics,
      },
    }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `simulare_${activeScenario.name.replace(/\s+/g, "_")}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Save simulation results to project and move to consultare_publica
  const handleSendToConsultare = async () => {
    if (!selectedProjectId || !activeScenario) return;
    const label = projectStageConfig["consultare_publica"]?.label || "Consultare publică";
    await apiPatch(`/projects/${selectedProjectId}`, {
      stage: "consultare_publica",
      stageLabel: label,
      simulationResults: activeScenario.metrics,
    });
    mutateProjects();
  };

  // Quick-create scenario from project geometry
  const handleQuickSimulate = async (project: Project) => {
    setSelectedProjectId(project.id);
    try {
      const created = await createScenario({
        name: `Simulare: ${project.title}`,
        ...(project.id ? { projectId: project.id } as any : {}),
      });
      await mutateScenarios();
      setActiveScenario(created);
    } catch (e) {
      console.error("Failed", e);
    }
  };

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
              Rulează simulări pe proiecte și compară scenarii
            </p>
          </div>
          <div className="flex gap-2">
            {activeScenario && (
              <Button variant="outline" size="sm" onClick={handleExportGeoJSON}>
                <FileDown className="h-4 w-4 mr-1" /> Export GeoJSON
              </Button>
            )}
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0">
          {/* Controls Panel */}
          <div className="w-full lg:w-72 shrink-0 flex flex-col gap-3">
            {/* Project list */}
            <GlassCard className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <FolderOpen className="h-4 w-4 text-primary" />
                <span className="text-xs font-semibold">Proiecte</span>
              </div>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                <button
                  onClick={() => { setSelectedProjectId(null); setActiveScenario(null); }}
                  className={`w-full text-left p-2 rounded-lg text-xs transition-all ${
                    !selectedProjectId
                      ? "bg-warning/10 text-warning border border-warning/30"
                      : "text-muted-foreground hover:bg-surface-light"
                  }`}
                >
                  Toate scenariile
                </button>
                {eligibleProjects.map((p) => (
                  <div
                    key={p.id}
                    className={`flex items-center gap-1 p-2 rounded-lg text-xs transition-all ${
                      selectedProjectId === p.id
                        ? "bg-warning/10 text-warning border border-warning/30"
                        : "text-muted-foreground hover:bg-surface-light"
                    }`}
                  >
                    <button
                      onClick={() => { setSelectedProjectId(p.id); setActiveScenario(null); }}
                      className="flex-1 text-left min-w-0"
                    >
                      <p className="font-medium text-foreground line-clamp-1">{p.title}</p>
                      <span className="text-[10px]">
                        {projectStageConfig[p.stage]?.label}
                        {p.geometry ? " • are geometrie" : " • fără geometrie"}
                      </span>
                    </button>
                    {p.geometry && !filteredScenarios.some((s) => s.projectId === p.id) && (
                      <button
                        onClick={() => handleQuickSimulate(p)}
                        className="p-1 rounded hover:bg-warning/20 text-warning shrink-0"
                        title="Simulează rapid"
                      >
                        <Play className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
                {eligibleProjects.length === 0 && (
                  <p className="text-[10px] text-muted-foreground py-2 text-center">
                    Niciun proiect disponibil
                  </p>
                )}
              </div>
            </GlassCard>

            {/* Scenario List */}
            <GlassCard className="p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground font-medium">Scenarii</p>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setCreating(!creating)}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
              {creating && (
                <div className="flex gap-1.5 mb-2">
                  <input
                    className="flex-1 bg-surface-light rounded-lg px-2 py-1.5 text-xs border border-border focus:outline-none focus:border-warning/50"
                    placeholder={selectedProject ? `Simulare: ${selectedProject.title}` : "Nume scenariu..."}
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  />
                  <Button size="sm" variant="outline" onClick={handleCreate} className="text-xs h-7">OK</Button>
                </div>
              )}
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {filteredScenarios.map((sc) => (
                  <div
                    key={sc.id}
                    className={`w-full text-left p-2 rounded-lg text-xs transition-all group ${
                      activeScenario?.id === sc.id
                        ? "bg-warning/10 border border-warning/30 text-warning"
                        : "hover:bg-surface-light text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <button onClick={() => setActiveScenario(sc)} className="flex-1 text-left">
                        <p className="font-medium">{sc.name}</p>
                        <p className="text-[10px] mt-0.5 opacity-70">{sc.description}</p>
                        {sc.metrics.veloScore != null && (
                          <p className="text-[10px] mt-0.5 font-semibold" style={{ color: "#10b981" }}>
                            VeloScore: {sc.metrics.veloScore}/100
                          </p>
                        )}
                      </button>
                      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleRerun(sc.id)}
                          className={`p-1 hover:text-warning ${runningId === sc.id ? "animate-spin" : ""}`}
                          title="Rerulare"
                        >
                          <RefreshCw className="h-3 w-3" />
                        </button>
                        <button onClick={() => handleDelete(sc.id)} className="p-1 hover:text-destructive" title="Șterge">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {filteredScenarios.length === 0 && (
                  <p className="text-[10px] text-center py-3 text-muted-foreground">
                    {selectedProjectId ? "Nicio simulare. Creează una." : "Niciun scenariu."}
                  </p>
                )}
              </div>
            </GlassCard>

            {/* VeloScore + Improvement Rating */}
            {activeScenario && (() => {
              const baseVelo = baseline.veloScore ?? 0;
              const scenarioVelo = activeScenario.metrics.veloScore ?? 0;
              const delta = scenarioVelo - baseVelo;
              const rating = getImprovementRating(delta);
              return (
                <GlassCard className="p-4 border-emerald-500/20">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Gauge className="h-5 w-5 text-emerald-400" />
                    <span className="text-sm font-bold text-emerald-400">VeloScore Compozit</span>
                  </div>
                  <div className="flex items-center justify-center gap-3 mb-2">
                    <div className="text-center">
                      <p className="text-[10px] text-muted-foreground">Actual</p>
                      <span className="text-lg text-muted-foreground font-semibold">{baseVelo}</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    <div className="text-center">
                      <p className="text-[10px] text-muted-foreground">Scenariu</p>
                      <motion.span
                        className="text-3xl font-black block"
                        style={{ color: "#10b981" }}
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        key={scenarioVelo}
                        transition={{ type: "spring", stiffness: 200 }}
                      >
                        {scenarioVelo}
                      </motion.span>
                    </div>
                    <span className="text-xs text-muted-foreground self-end mb-1">/100</span>
                  </div>

                  {/* Improvement rating */}
                  <div className="rounded-lg px-3 py-2 text-center" style={{ backgroundColor: `${rating.color}15` }}>
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-base">{rating.emoji}</span>
                      <span className="text-sm font-bold" style={{ color: rating.color }}>
                        {rating.label}
                      </span>
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: rating.color }}>
                      {delta > 0 ? "+" : ""}{delta} puncte față de situația curentă
                    </p>
                  </div>

                  <p className="text-[10px] text-muted-foreground mt-2 text-center">
                    Siguranță × 0.40 + Acoperire × 0.35 + Accesibilitate × 0.25
                  </p>
                </GlassCard>
              );
            })()}

            {/* Metrics Comparison */}
            <GlassCard className="p-3 flex-1">
              <p className="text-xs text-muted-foreground font-medium mb-3">Metrici</p>
              <div className="space-y-3">
                {metricConfig.map((m) => {
                  const current = baseline[m.key] ?? 0;
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
                        <div className="flex-1 bg-surface-light rounded-full overflow-hidden">
                          <motion.div
                            className="h-full rounded-full opacity-50"
                            style={{ backgroundColor: m.color }}
                            initial={{ width: 0 }}
                            animate={{ width: `${m.key === "conflictZones" ? Math.min(current * 3, 100) : current}%` }}
                            transition={{ duration: 0.8 }}
                          />
                        </div>
                        <div className="flex-1 bg-surface-light rounded-full overflow-hidden">
                          <motion.div
                            className="h-full rounded-full"
                            style={{ backgroundColor: m.color }}
                            initial={{ width: 0 }}
                            animate={{ width: `${m.key === "conflictZones" ? Math.min(future * 3, 100) : future}%` }}
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

            {/* Actions */}
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
                <span className="text-xs text-muted-foreground w-10 text-right">{timelineValue}%</span>
              </div>
              {selectedProject && activeScenario && selectedProject.stage === "simulare" && (
                <Button size="sm" variant="accent" className="w-full mt-2 text-xs" onClick={handleSendToConsultare}>
                  <ArrowRight className="h-3.5 w-3.5 mr-1" /> Trimite la consultare publică
                </Button>
              )}
            </GlassCard>
          </div>

          {/* Split Map Area */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2 min-h-[300px] sm:min-h-[400px]">
            <div className="rounded-xl overflow-hidden border border-border relative">
              <div className="absolute top-3 left-3 z-[1000] glass rounded-lg px-3 py-1.5 text-xs font-medium flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Situația curentă
              </div>
              <SimMap variant="current" />
            </div>
            <div className="rounded-xl overflow-hidden border border-border relative">
              <div className="absolute top-3 left-3 z-[1000] glass rounded-lg px-3 py-1.5 text-xs font-medium flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-green-500" /> Scenariu: {activeScenario?.name ?? "—"}
              </div>
              <SimMap
                variant="future"
                scenarioChanges={activeScenario?.changes}
                projectGeometry={selectedProject?.geometry}
              />
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
