"use client";

import { useState, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import {
  Layers,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  MapPin,
  Ruler,
  Square,
  Pencil,
  Check,
  X,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Undo2,
  Play,
  RotateCcw,
  Shield,
  Accessibility,
  RefreshCw,
  FileDown,
  ArrowRight,
  Save,
  FileText,
  CheckCircle2,
  Info,
  PlusCircle,
  AlertTriangle,
  Gauge,
} from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageTransition } from "@/components/ui/page-transition";
import {
  useInfrastructureLayers,
  useProjects,
  useSimulations,
  useSimulationBaseline,
  createScenario,
  deleteScenario,
  runScenario,
  apiPost,
  apiPatch,
} from "@/lib/api";
import { projectStageConfig, projectTypeLabels } from "@/lib/mock-data";
import type { InfrastructureType, Project, SimulationScenario } from "@/types";
import type { DrawnFeature } from "./scenario-edit-map";

/* ──────────────────────────────────────────
   Dynamic map imports
   ────────────────────────────────────────── */

const SimMap = dynamic<{
  variant: "current" | "future";
  scenarioChanges?: any;
  projectGeometry?: any;
}>(() => import("@/app/admin/simulare/sim-map").then((m) => m.default), {
  ssr: false,
});

const ScenarioEditMap = dynamic<{
  scenarioChanges?: any;
  projectGeometry?: any;
  drawnFeatures: DrawnFeature[];
  activeTool: string;
  drawingLine: [number, number][];
  onAddPoint?: (latlng: { lat: number; lng: number }) => void;
  onAddLine?: (coords: [number, number][]) => void;
}>(
  () =>
    import("@/app/admin/infrastructura/scenario-edit-map").then(
      (m) => m.default
    ),
  { ssr: false }
);

/* ──────────────────────────────────────────
   Constants
   ────────────────────────────────────────── */

type DrawingTool = "select" | "point" | "line" | "polygon";

interface InfraLayer {
  id: string;
  type: InfrastructureType;
  label: string;
  color: string;
  icon: string;
  visible: boolean;
  count: number;
}

const drawingTools: { tool: DrawingTool; icon: typeof MapPin; label: string }[] =
  [
    { tool: "select", icon: Pencil, label: "Selectare" },
    { tool: "point", icon: MapPin, label: "Punct" },
    { tool: "line", icon: Ruler, label: "Linie" },
    { tool: "polygon", icon: Square, label: "Poligon" },
  ];

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

const infraColors: Record<string, string> = {
  pista_biciclete: "#a3e635",
  parcare_biciclete: "#00d4ff",
  semafor: "#f59e0b",
  zona_30: "#a855f7",
  zona_pietonala: "#ec4899",
};

/* ──────────────────────────────────────────
   Page Component
   ────────────────────────────────────────── */

export default function AdminProiectareSimularePage() {
  /* ── Data hooks ── */
  const { data: apiLayers } = useInfrastructureLayers();
  const { data: apiProjects, mutate: mutateProjects } = useProjects();
  const { data: scenarios, mutate: mutateScenarios } = useSimulations();
  const { data: baselineData } = useSimulationBaseline();

  /* ── Project state ── */
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null
  );
  const [detailProjectId, setDetailProjectId] = useState<string | null>(null);
  const [showProjectList, setShowProjectList] = useState(true);

  const projects = apiProjects ?? [];
  const eligibleProjects = useMemo(
    () =>
      projects.filter((p) =>
        ["simulare", "proiectare"].includes(p.stage)
      ),
    [projects]
  );
  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );
  const detailProject = useMemo(
    () => projects.find((p) => p.id === detailProjectId) ?? null,
    [projects, detailProjectId]
  );

  /* ── Drawing state ── */
  const [activeTool, setActiveTool] = useState<DrawingTool>("select");
  const [drawingLine, setDrawingLine] = useState<[number, number][]>([]);
  const [drawnFeatures, setDrawnFeatures] = useState<DrawnFeature[]>([]);
  const [showLineForm, setShowLineForm] = useState(false);
  const [showPointForm, setShowPointForm] = useState(false);
  const [pendingPoint, setPendingPoint] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [newFeatureName, setNewFeatureName] = useState("");
  const [newFeatureType, setNewFeatureType] = useState("pista_biciclete");

  /* ── Layer state ── */
  const [layers, setLayers] = useState<InfraLayer[]>([]);
  const [layersInit, setLayersInit] = useState(false);
  const [showLegend, setShowLegend] = useState(true);

  /* ── Simulation state ── */
  const allScenarios = scenarios ?? [];
  const filteredScenarios = useMemo(() => {
    if (!selectedProjectId) return allScenarios;
    return allScenarios.filter((s) => s.projectId === selectedProjectId);
  }, [allScenarios, selectedProjectId]);

  const [activeScenario, setActiveScenario] =
    useState<SimulationScenario | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [runningId, setRunningId] = useState<string | null>(null);

  const baseline = baselineData ?? {
    safetyScore: 0,
    coveragePercent: 0,
    conflictZones: 0,
    accessibilityScore: 0,
    veloScore: 0,
  };

  /* ── Transition (send to consultare) state ── */
  const [transitionProject, setTransitionProject] = useState<Project | null>(
    null
  );
  const [transitionData, setTransitionData] = useState({
    budget: "",
    timeline: "",
    team: "",
    startDate: "",
    endDate: "",
    workingHours: "",
    description: "",
  });
  const [transitioning, setTransitioning] = useState(false);

  /* ── Create from scratch state ── */
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createData, setCreateData] = useState({
    title: "",
    description: "",
    projectType: "infrastructura_mixta",
    timeline: "TBD",
  });

  /* ── Initialize layers once ── */
  if (apiLayers && !layersInit) {
    setLayers(
      apiLayers.map((l) => ({
        id: l.id,
        type: l.type as InfrastructureType,
        label: l.label,
        color: l.color,
        icon: l.icon,
        visible: l.isDefaultVisible,
        count: l.count,
      }))
    );
    setLayersInit(true);
  }

  // Auto-select first scenario
  if (filteredScenarios.length > 0 && !activeScenario) {
    setActiveScenario(filteredScenarios[0]);
  }

  const toggleLayer = (id: string) =>
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l))
    );
  const totalElements = useMemo(
    () => layers.reduce((s, l) => s + l.count, 0),
    [layers]
  );

  /* ────────────────────────────
     Drawing handlers
     ──────────────────────────── */

  const handleAddPoint = (latlng: { lat: number; lng: number }) => {
    setPendingPoint(latlng);
    setShowPointForm(true);
    setNewFeatureName("");
    setNewFeatureType("parcare_biciclete");
  };

  const handleCreatePoint = () => {
    if (!pendingPoint || !newFeatureName) return;
    const feat: DrawnFeature = {
      id: `drawn-${Date.now()}`,
      geometry: {
        type: "Point",
        coordinates: [pendingPoint.lng, pendingPoint.lat],
      },
      name: newFeatureName,
      color: "#f97316",
    };
    setDrawnFeatures((prev) => [...prev, feat]);
    setShowPointForm(false);
    setPendingPoint(null);
  };

  const handleAddLine = (coords: [number, number][]) =>
    setDrawingLine(coords);

  const handleFinishLine = () => {
    if (drawingLine.length < 2) return;
    setShowLineForm(true);
    setNewFeatureName("");
    setNewFeatureType("pista_biciclete");
  };

  const handleCreateLine = () => {
    if (drawingLine.length < 2 || !newFeatureName) return;
    const geoCoords = drawingLine.map(([lat, lng]) => [lng, lat]);
    const feat: DrawnFeature = {
      id: `drawn-${Date.now()}`,
      geometry: { type: "LineString", coordinates: geoCoords },
      name: newFeatureName,
      color: "#f97316",
    };
    setDrawnFeatures((prev) => [...prev, feat]);
    setShowLineForm(false);
    setDrawingLine([]);
  };

  const handleUndoLastPoint = () =>
    setDrawingLine((p) => p.slice(0, -1));
  const handleCancelDraw = () => {
    setDrawingLine([]);
    setShowLineForm(false);
  };

  const handleUndoFeature = () =>
    setDrawnFeatures((prev) => prev.slice(0, -1));
  const handleResetSession = () => {
    setDrawnFeatures([]);
    setDrawingLine([]);
    setShowLineForm(false);
    setShowPointForm(false);
    setPendingPoint(null);
  };

  /* ────────────────────────────
     Project actions
     ──────────────────────────── */

  const handleUpdateProject = async () => {
    if (!selectedProjectId || drawnFeatures.length === 0) return;
    const existingGeo = selectedProject?.geometry || {
      type: "FeatureCollection",
      features: [],
    };
    const existingFeatures =
      existingGeo.type === "FeatureCollection"
        ? existingGeo.features || []
        : [{ type: "Feature", geometry: existingGeo, properties: {} }];

    const newFeatures = drawnFeatures.map((f) => ({
      type: "Feature",
      geometry: f.geometry,
      properties: { name: f.name, drawnAt: new Date().toISOString() },
    }));

    const merged = {
      type: "FeatureCollection",
      features: [...existingFeatures, ...newFeatures],
    };

    await apiPatch(`/projects/${selectedProjectId}`, { geometry: merged });
    mutateProjects();
    setDrawnFeatures([]);
  };

  const handleSendToConsultare = () => {
    if (!selectedProject) return;
    setTransitionProject(selectedProject);
    setTransitionData({
      budget: selectedProject.budget || "",
      timeline: selectedProject.timeline || "",
      team: selectedProject.team || "",
      startDate: selectedProject.startDate
        ? selectedProject.startDate.slice(0, 10)
        : "",
      endDate: selectedProject.endDate
        ? selectedProject.endDate.slice(0, 10)
        : "",
      workingHours: selectedProject.workingHours || "",
      description: selectedProject.description || "",
    });
  };

  const handleTransitionSubmit = async () => {
    if (!transitionProject) return;
    setTransitioning(true);
    try {
      const label =
        projectStageConfig["consultare_publica"]?.label || "Consultare publică";
      await apiPatch(`/projects/${transitionProject.id}`, {
        stage: "consultare_publica",
        stageLabel: label,
        simulationResults: activeScenario?.metrics ?? undefined,
        budget: transitionData.budget || undefined,
        timeline: transitionData.timeline || undefined,
        team: transitionData.team || undefined,
        startDate: transitionData.startDate || undefined,
        endDate: transitionData.endDate || undefined,
        workingHours: transitionData.workingHours || undefined,
        description: transitionData.description || undefined,
      });
      mutateProjects();
      setTransitionProject(null);
    } finally {
      setTransitioning(false);
    }
  };

  const handleCreateFromScratch = async () => {
    if (!createData.title) return;
    try {
      await apiPost("/projects", {
        title: createData.title,
        description: createData.description || "Proiect nou creat de la zero",
        projectType: createData.projectType,
        timeline: createData.timeline || "TBD",
        latitude: 44.4505,
        longitude: 26.12,
        address: "București",
        stage: "simulare",
        stageLabel: "Simulare",
      });
      mutateProjects();
      setShowCreateForm(false);
      setCreateData({
        title: "",
        description: "",
        projectType: "infrastructura_mixta",
        timeline: "TBD",
      });
    } catch (e) {
      console.error("Failed to create project", e);
    }
  };

  /* ────────────────────────────
     Simulation handlers
     ──────────────────────────── */

  /** Build a merged GeoJSON FeatureCollection from project geometry + drawn features */
  const buildChangesGeoJSON = useCallback(() => {
    const existingGeo = selectedProject?.geometry || { type: "FeatureCollection", features: [] };
    const existingFeatures =
      existingGeo.type === "FeatureCollection"
        ? existingGeo.features || []
        : existingGeo.type ? [{ type: "Feature", geometry: existingGeo, properties: {} }] : [];

    const drawnGeoFeatures = drawnFeatures.map((f) => ({
      type: "Feature" as const,
      geometry: f.geometry,
      properties: { name: f.name, type: f.geometry.type === "Point" ? "parcare_biciclete" : "pista_biciclete" },
    }));

    const allFeatures = [...existingFeatures, ...drawnGeoFeatures];
    if (allFeatures.length === 0) return null;
    return { type: "FeatureCollection", features: allFeatures };
  }, [selectedProject, drawnFeatures]);

  const handleCreateScenario = useCallback(async () => {
    const name =
      newName.trim() ||
      (selectedProject ? `Simulare: ${selectedProject.title}` : "");
    if (!name) return;
    try {
      const changes = buildChangesGeoJSON();
      const created = await createScenario({
        name,
        ...(changes ? { changes } : {}),
        ...(selectedProjectId ? { projectId: selectedProjectId } : {}),
      });
      await mutateScenarios();
      setActiveScenario(created);
      setNewName("");
      setCreating(false);
    } catch (e) {
      console.error("Failed to create scenario", e);
    }
  }, [newName, selectedProjectId, selectedProject, mutateScenarios, buildChangesGeoJSON]);

  const handleDeleteScenario = useCallback(
    async (id: string) => {
      try {
        await deleteScenario(id);
        await mutateScenarios();
        if (activeScenario?.id === id) setActiveScenario(null);
      } catch (e) {
        console.error("Failed to delete scenario", e);
      }
    },
    [activeScenario, mutateScenarios]
  );

  const handleRerun = useCallback(
    async (id: string) => {
      setRunningId(id);
      try {
        const updated = await runScenario(id);
        await mutateScenarios();
        // Merge with existing scenario data so we don't lose fields like description/changes
        setActiveScenario((prev) =>
          prev?.id === id ? { ...prev, ...updated } : updated
        );
      } catch (e) {
        console.error("Failed to rerun scenario", e);
      } finally {
        setRunningId(null);
      }
    },
    [mutateScenarios]
  );

  const handleQuickSimulate = async (project: Project) => {
    setSelectedProjectId(project.id);
    try {
      // Use project's stored geometry directly
      const projGeo = project.geometry;
      const changes = projGeo && projGeo.type === "FeatureCollection" && projGeo.features?.length > 0
        ? projGeo : null;
      const created = await createScenario({
        name: `Simulare: ${project.title}`,
        ...(changes ? { changes } : {}),
        ...(project.id ? { projectId: project.id } : {}),
      });
      await mutateScenarios();
      setActiveScenario(created);
    } catch (e) {
      console.error("Failed", e);
    }
  };

  const handleExportGeoJSON = () => {
    if (!activeScenario) return;
    const blob = new Blob(
      [
        JSON.stringify(
          {
            type: "FeatureCollection",
            features: activeScenario.changes?.features || [],
            properties: {
              scenarioName: activeScenario.name,
              metrics: activeScenario.metrics,
            },
          },
          null,
          2
        ),
      ],
      { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `simulare_${activeScenario.name.replace(/\s+/g, "_")}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ──────────────────────────────────────────
     RENDER
     ────────────────────────────────────────── */

  return (
    <PageTransition>
      <div className="h-[calc(100vh-3.5rem-2rem)] sm:h-[calc(100vh-3.5rem-3rem)] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold font-[family-name:var(--font-heading)]">
              Proiectare & Simulare
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Editează infrastructura, rulează simulări și gestionează proiecte
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

        {/* Body */}
        <div className="flex-1 flex flex-col lg:flex-row gap-3 min-h-0 overflow-hidden">
          {/* ─── Left Panel ─── */}
          <div className="w-full lg:w-80 shrink-0 flex flex-col gap-2 overflow-y-auto pr-1">
            {/* ── Project Selector ── */}
            <GlassCard className="p-3">
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setShowProjectList(!showProjectList)}
              >
                <div className="flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">Proiecte</span>
                </div>
                <ChevronRight
                  className={`h-4 w-4 text-muted-foreground transition-transform ${showProjectList ? "rotate-90" : ""}`}
                />
              </div>
              <AnimatePresence>
                {showProjectList && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-2 space-y-1 max-h-44 overflow-y-auto">
                      <button
                        onClick={() => {
                          setSelectedProjectId(null);
                          setActiveScenario(null);
                        }}
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
                          className={`flex items-center gap-1 p-2 rounded-lg text-xs transition-all group/proj ${
                            selectedProjectId === p.id
                              ? "bg-warning/10 text-warning border border-warning/30"
                              : "text-muted-foreground hover:bg-surface-light hover:text-foreground"
                          }`}
                        >
                          <button
                            onClick={() => {
                              setSelectedProjectId(p.id);
                              setActiveScenario(null);
                              setDrawnFeatures([]);
                              setDrawingLine([]);
                            }}
                            className="flex-1 text-left min-w-0"
                          >
                            <p className="font-medium text-foreground line-clamp-1">
                              {p.title}
                            </p>
                            <div className="flex items-center gap-1 mt-0.5">
                              <span
                                className="h-1.5 w-1.5 rounded-full shrink-0"
                                style={{
                                  backgroundColor:
                                    p.stage === "simulare"
                                      ? "#6366f1"
                                      : p.stage === "consultare_publica"
                                        ? "#a855f7"
                                        : "#3b82f6",
                                }}
                              />
                              <span>
                                {projectStageConfig[p.stage]?.label || p.stage}
                              </span>
                              {p.geometry && (
                                <span className="ml-1">• geometrie</span>
                              )}
                            </div>
                          </button>
                          <div className="flex items-center gap-0.5 shrink-0">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDetailProjectId(
                                  detailProjectId === p.id ? null : p.id
                                );
                              }}
                              className="p-1 rounded hover:bg-warning/20 text-muted-foreground hover:text-warning opacity-0 group-hover/proj:opacity-100 transition-all"
                              title="Detalii proiect"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                            {p.geometry &&
                              !filteredScenarios.some(
                                (s) => s.projectId === p.id
                              ) && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleQuickSimulate(p);
                                  }}
                                  className="p-1 rounded hover:bg-warning/20 text-warning shrink-0"
                                  title="Simulează rapid"
                                >
                                  <Play className="h-3.5 w-3.5" />
                                </button>
                              )}
                          </div>
                        </div>
                      ))}
                      {eligibleProjects.length === 0 && (
                        <p className="text-[10px] text-muted-foreground py-2 text-center">
                          Niciun proiect disponibil
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => setShowCreateForm(true)}
                      className="w-full flex items-center gap-1.5 justify-center p-2 mt-1.5 rounded-lg text-xs border border-dashed border-border text-muted-foreground hover:text-warning hover:border-warning/30 transition-all"
                    >
                      <PlusCircle className="h-3.5 w-3.5" /> Proiect nou (de
                      la zero)
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </GlassCard>

            {/* ── Project Details Popup ── */}
            <AnimatePresence>
              {detailProject && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <GlassCard className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <Info className="h-3.5 w-3.5 text-primary" />
                        <span className="text-xs font-semibold">
                          Detalii proiect
                        </span>
                      </div>
                      <button
                        onClick={() => setDetailProjectId(null)}
                        className="p-0.5 rounded hover:bg-surface-light"
                      >
                        <X className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </div>
                    <div className="space-y-1.5 text-xs">
                      <div>
                        <span className="text-muted-foreground">Titlu</span>
                        <p className="font-medium">{detailProject.title}</p>
                      </div>
                      {detailProject.description && (
                        <div>
                          <span className="text-muted-foreground">
                            Descriere
                          </span>
                          <p className="line-clamp-3">
                            {detailProject.description}
                          </p>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-1.5">
                        <div>
                          <span className="text-muted-foreground">Etapă</span>
                          <p className="font-medium">
                            {projectStageConfig[detailProject.stage]?.label ||
                              detailProject.stage}
                          </p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Tip</span>
                          <p className="font-medium">
                            {(detailProject.projectType && projectTypeLabels[detailProject.projectType]) ||
                              detailProject.projectType || "—"}
                          </p>
                        </div>
                        {detailProject.budget && (
                          <div>
                            <span className="text-muted-foreground">
                              Buget
                            </span>
                            <p className="font-medium">
                              {detailProject.budget}
                            </p>
                          </div>
                        )}
                        {detailProject.timeline && (
                          <div>
                            <span className="text-muted-foreground">
                              Timeline
                            </span>
                            <p className="font-medium">
                              {detailProject.timeline}
                            </p>
                          </div>
                        )}
                        {detailProject.team && (
                          <div>
                            <span className="text-muted-foreground">
                              Echipă
                            </span>
                            <p className="font-medium">
                              {detailProject.team}
                            </p>
                          </div>
                        )}
                        {detailProject.address && (
                          <div>
                            <span className="text-muted-foreground">
                              Adresă
                            </span>
                            <p className="font-medium">
                              {detailProject.address}
                            </p>
                          </div>
                        )}
                      </div>
                      {detailProject.simulationResults && (
                        <div className="pt-1 border-t border-border">
                          <span className="text-muted-foreground">
                            Rezultate simulare
                          </span>
                          <div className="grid grid-cols-2 gap-1 mt-1">
                            {Object.entries(
                              detailProject.simulationResults
                            ).map(([k, v]) => (
                              <div key={k} className="text-[10px]">
                                <span className="text-muted-foreground">
                                  {k}:
                                </span>{" "}
                                <span className="font-medium">
                                  {String(v)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </GlassCard>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Drawing Tools ── */}
            <GlassCard className="p-3">
              <p className="text-xs text-muted-foreground mb-2 font-medium">
                Instrumente desen (hartă scenariu)
              </p>
              <div className="grid grid-cols-4 gap-1">
                {drawingTools.map((t) => (
                  <button
                    key={t.tool}
                    onClick={() => {
                      setActiveTool(t.tool);
                      if (t.tool !== "line") {
                        setDrawingLine([]);
                        setShowLineForm(false);
                      }
                    }}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg text-xs transition-all ${
                      activeTool === t.tool
                        ? "bg-warning/20 text-warning border border-warning/30"
                        : "text-muted-foreground hover:text-foreground hover:bg-surface-light"
                    }`}
                  >
                    <t.icon className="h-4 w-4" />
                    {t.label}
                  </button>
                ))}
              </div>
              {activeTool === "line" && drawingLine.length > 0 && (
                <div className="mt-2 flex gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 text-xs"
                    onClick={handleUndoLastPoint}
                  >
                    <Undo2 className="h-3 w-3 mr-1" /> Înapoi
                  </Button>
                  {drawingLine.length >= 2 && (
                    <Button
                      size="sm"
                      variant="accent"
                      className="flex-1 text-xs"
                      onClick={handleFinishLine}
                    >
                      <Check className="h-3 w-3 mr-1" /> Gata
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="destructive"
                    className="text-xs"
                    onClick={handleCancelDraw}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
              {activeTool === "line" && drawingLine.length === 0 && (
                <p className="text-[10px] text-muted-foreground mt-2">
                  Click pe harta scenariu pentru a adăuga puncte.
                </p>
              )}
              {drawnFeatures.length > 0 && (
                <div className="flex gap-1.5 mt-2 pt-2 border-t border-border">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 text-xs"
                    onClick={handleUndoFeature}
                  >
                    <Undo2 className="h-3 w-3 mr-1" /> Undo ({drawnFeatures.length})
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="flex-1 text-xs"
                    onClick={handleResetSession}
                  >
                    <RotateCcw className="h-3 w-3 mr-1" /> Reset
                  </Button>
                </div>
              )}
              {selectedProject && drawnFeatures.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-xs mt-2"
                  onClick={handleUpdateProject}
                >
                  <Save className="h-3.5 w-3.5 mr-1" /> Salvează proiect
                  ({drawnFeatures.length} elem.)
                </Button>
              )}
            </GlassCard>

            {/* ── Point Form ── */}
            <AnimatePresence>
              {showPointForm && pendingPoint && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                >
                  <GlassCard className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold">Punct nou</span>
                      <button
                        onClick={() => {
                          setShowPointForm(false);
                          setPendingPoint(null);
                        }}
                        className="p-0.5 rounded hover:bg-surface-light"
                      >
                        <X className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </div>
                    <div className="space-y-2 text-xs">
                      <p className="text-muted-foreground">
                        Lat: {pendingPoint.lat.toFixed(5)}, Lng:{" "}
                        {pendingPoint.lng.toFixed(5)}
                      </p>
                      <Input
                        placeholder="Nume element"
                        value={newFeatureName}
                        onChange={(e) => setNewFeatureName(e.target.value)}
                        className="text-xs h-7"
                      />
                      <select
                        value={newFeatureType}
                        onChange={(e) => setNewFeatureType(e.target.value)}
                        className="w-full bg-surface border border-border rounded-lg text-xs px-2 py-1.5 text-foreground"
                      >
                        <option value="parcare_biciclete">
                          Parcare biciclete
                        </option>
                        <option value="semafor">Semafor biciclete</option>
                        <option value="zona_30">Zonă 30 km/h</option>
                        <option value="zona_pietonala">Zonă pietonală</option>
                      </select>
                      <Button
                        size="sm"
                        variant="accent"
                        className="w-full text-xs"
                        onClick={handleCreatePoint}
                        disabled={!newFeatureName}
                      >
                        <Plus className="h-3 w-3 mr-1" /> Adaugă
                      </Button>
                    </div>
                  </GlassCard>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Line Form ── */}
            <AnimatePresence>
              {showLineForm && drawingLine.length >= 2 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                >
                  <GlassCard className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold">Linie nouă</span>
                      <button
                        onClick={handleCancelDraw}
                        className="p-0.5 rounded hover:bg-surface-light"
                      >
                        <X className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </div>
                    <div className="space-y-2 text-xs">
                      <p className="text-muted-foreground">
                        {drawingLine.length} puncte •{" "}
                        ~{estimateLength(drawingLine).toFixed(0)}m
                      </p>
                      <Input
                        placeholder="Nume (ex: Pistă Bd. Lacul Tei)"
                        value={newFeatureName}
                        onChange={(e) => setNewFeatureName(e.target.value)}
                        className="text-xs h-7"
                      />
                      <select
                        value={newFeatureType}
                        onChange={(e) => setNewFeatureType(e.target.value)}
                        className="w-full bg-surface border border-border rounded-lg text-xs px-2 py-1.5 text-foreground"
                      >
                        <option value="pista_biciclete">
                          Pistă biciclete
                        </option>
                        <option value="zona_30">Zonă 30 km/h</option>
                        <option value="zona_pietonala">Zonă pietonală</option>
                      </select>
                      <Button
                        size="sm"
                        variant="accent"
                        className="w-full text-xs"
                        onClick={handleCreateLine}
                        disabled={!newFeatureName}
                      >
                        <Plus className="h-3 w-3 mr-1" /> Salvează linia
                      </Button>
                    </div>
                  </GlassCard>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Scenarios ── */}
            <GlassCard className="p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground font-medium">
                  Scenarii simulare
                </p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setCreating(!creating)}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
              {creating && (
                <div className="flex gap-1.5 mb-2">
                  <input
                    className="flex-1 bg-surface-light rounded-lg px-2 py-1.5 text-xs border border-border focus:outline-none focus:border-warning/50"
                    placeholder={
                      selectedProject
                        ? `Simulare: ${selectedProject.title}`
                        : "Nume scenariu..."
                    }
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && handleCreateScenario()
                    }
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCreateScenario}
                    className="text-xs h-7"
                  >
                    OK
                  </Button>
                </div>
              )}
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
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
                      <button
                        onClick={() => setActiveScenario(sc)}
                        className="flex-1 text-left"
                      >
                        <p className="font-medium">{sc.name}</p>
                        <p className="text-[10px] mt-0.5 opacity-70">
                          {sc.description}
                        </p>
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
                        <button
                          onClick={() => handleDeleteScenario(sc.id)}
                          className="p-1 hover:text-destructive"
                          title="Șterge"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {filteredScenarios.length === 0 && (
                  <p className="text-[10px] text-center py-2 text-muted-foreground">
                    {selectedProjectId
                      ? "Nicio simulare. Creează una."
                      : "Niciun scenariu."}
                  </p>
                )}
              </div>
            </GlassCard>

            {/* ── VeloScore Composite ── */}
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

            {/* ── Metrics ── */}
            <GlassCard className="p-3">
              <p className="text-xs text-muted-foreground font-medium mb-2">
                Rezultate simulare
              </p>
              <div className="space-y-2.5">
                {metricConfig.map((m) => {
                  const current = baseline[m.key] ?? 0;
                  const future = activeScenario?.metrics[m.key] ?? 0;
                  const improved = m.key === "conflictZones" ? future < current : future > current;
                  return (
                    <div key={m.key}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <div className="flex items-center gap-1.5">
                          <m.icon
                            className="h-3.5 w-3.5"
                            style={{ color: m.color }}
                          />
                          <span className="text-muted-foreground">
                            {m.label}
                          </span>
                        </div>
                        <span
                          className={
                            improved ? "text-accent" : "text-destructive"
                          }
                        >
                          {current}{" "}
                          <ChevronRight className="inline h-3 w-3" /> {future}
                          {m.suffix}
                        </span>
                      </div>
                      <div className="flex gap-1 h-1.5">
                        <div className="flex-1 bg-surface-light rounded-full overflow-hidden">
                          <motion.div
                            className="h-full rounded-full opacity-50"
                            style={{ backgroundColor: m.color }}
                            initial={{ width: 0 }}
                            animate={{
                              width: `${current}%`,
                            }}
                            transition={{ duration: 0.8 }}
                          />
                        </div>
                        <div className="flex-1 bg-surface-light rounded-full overflow-hidden">
                          <motion.div
                            className="h-full rounded-full"
                            style={{ backgroundColor: m.color }}
                            initial={{ width: 0 }}
                            animate={{
                              width: `${future}%`,
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

            {/* ── Run Simulation ── */}
            {activeScenario && (
              <GlassCard className="p-3">
                <Button
                  size="sm"
                  variant="accent"
                  className="w-full text-xs"
                  disabled={runningId === activeScenario.id}
                  onClick={() => handleRerun(activeScenario.id)}
                >
                  {runningId === activeScenario.id ? (
                    <RefreshCw className="h-3.5 w-3.5 mr-1 animate-spin" />
                  ) : (
                    <Play className="h-3.5 w-3.5 mr-1" />
                  )}
                  {runningId === activeScenario.id
                    ? "Se rulează..."
                    : "Rulează simulare"}
                </Button>
              </GlassCard>
            )}

            {/* ── Actions ── */}
            <GlassCard className="p-3">
              <div className="flex flex-col gap-1.5">
                {selectedProject && (
                    <Button
                      size="sm"
                      variant="accent"
                      className="w-full text-xs"
                      onClick={handleSendToConsultare}
                    >
                      <ArrowRight className="h-3.5 w-3.5 mr-1" /> Trimite la
                      consultare publică
                    </Button>
                  )}
              </div>
            </GlassCard>
          </div>

          {/* ─── Map Area (dual) ─── */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2 min-h-[400px] relative">
            {/* ── Floating Legend (right side) ── */}
            <div className="absolute top-3 right-3 z-[1000] w-52">
              <div className="glass rounded-xl overflow-hidden">
                <button
                  onClick={() => setShowLegend((v) => !v)}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                    Legendă
                  </div>
                  <ChevronDown
                    className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
                      showLegend ? "" : "-rotate-90"
                    }`}
                  />
                </button>
                <AnimatePresence>
                  {showLegend && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-3 pb-2.5 space-y-1.5">
                        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Infrastructură existentă</p>
                        {[
                          { color: "#a3e635", label: "Pistă biciclete" },
                          { color: "#22d3ee", label: "Parcare biciclete" },
                          { color: "#f59e0b", label: "Semafor biciclete" },
                          { color: "#818cf8", label: "Bandă partajată" },
                        ].map((item) => (
                          <div key={item.label} className="flex items-center gap-2">
                            <div
                              className="h-2.5 w-6 rounded-sm shrink-0"
                              style={{ backgroundColor: item.color }}
                            />
                            <span className="text-[11px] text-muted-foreground">{item.label}</span>
                          </div>
                        ))}

                        <div className="border-t border-border my-1" />
                        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Scenariu</p>
                        {[
                          { color: "#f97316", label: "Element nou (desenat)", dash: false },
                          { color: "#a855f7", label: "Geometrie proiect", dash: true },
                        ].map((item) => (
                          <div key={item.label} className="flex items-center gap-2">
                            <div
                              className="h-2.5 w-6 rounded-sm shrink-0"
                              style={{
                                backgroundColor: item.dash ? "transparent" : item.color,
                                border: item.dash ? `2px dashed ${item.color}` : "none",
                              }}
                            />
                            <span className="text-[11px] text-muted-foreground">{item.label}</span>
                          </div>
                        ))}

                        {layers.length > 0 && (
                          <>
                            <div className="border-t border-border my-1" />
                            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Straturi ({totalElements})</p>
                            {layers.map((layer) => (
                              <button
                                key={layer.id}
                                onClick={() => toggleLayer(layer.id)}
                                className="flex items-center gap-2 w-full text-left group"
                              >
                                <div
                                  className="h-2.5 w-6 rounded-sm shrink-0 transition-opacity"
                                  style={{
                                    backgroundColor: layer.color,
                                    opacity: layer.visible ? 1 : 0.25,
                                  }}
                                />
                                <span
                                  className={`text-[11px] flex-1 truncate transition-colors ${
                                    layer.visible ? "text-foreground" : "text-muted-foreground line-through"
                                  }`}
                                >
                                  {layer.label}
                                </span>
                                <span className="text-[9px] text-muted-foreground">{layer.count}</span>
                              </button>
                            ))}
                          </>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="rounded-xl overflow-hidden border border-border relative">
              <div className="absolute top-3 left-3 z-[1000] glass rounded-lg px-3 py-1.5 text-xs font-medium flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500" />{" "}
                Situația curentă
              </div>
              <SimMap variant="current" />
            </div>
            <div className="rounded-xl overflow-hidden border border-border relative">
              <div className="absolute top-3 left-3 z-[1000] glass rounded-lg px-3 py-1.5 text-xs font-medium flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-green-500" />{" "}
                Scenariu: {activeScenario?.name ?? "—"}
              </div>
              {activeTool !== "select" && (
                <div className="absolute top-3 right-3 z-[1000] glass rounded-lg px-3 py-1.5 text-xs flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-accent animate-pulse" />
                  Mod:{" "}
                  <span className="font-medium text-warning">
                    {drawingTools.find((t) => t.tool === activeTool)?.label}
                  </span>
                </div>
              )}
              <ScenarioEditMap
                scenarioChanges={activeScenario?.changes}
                projectGeometry={selectedProject?.geometry}
                drawnFeatures={drawnFeatures}
                activeTool={activeTool}
                drawingLine={drawingLine}
                onAddPoint={handleAddPoint}
                onAddLine={handleAddLine}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ─── Transition Form Modal: Send to Consultare Publică ─── */}
      <AnimatePresence>
        {transitionProject && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-[1100]"
              onClick={() => setTransitionProject(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[1110] w-full max-w-lg"
            >
              <GlassCard className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <FileText className="h-4 w-4 text-purple-400" />
                      Detalii proiect — Consultare publică
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Completează detaliile pentru{" "}
                      <span className="text-foreground font-medium">
                        {transitionProject.title}
                      </span>
                    </p>
                  </div>
                  <button
                    onClick={() => setTransitionProject(null)}
                    className="p-1 rounded hover:bg-surface-light"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input
                    placeholder="Buget (ex: 2.5M RON)"
                    value={transitionData.budget}
                    onChange={(e) =>
                      setTransitionData((d) => ({
                        ...d,
                        budget: e.target.value,
                      }))
                    }
                  />
                  <Input
                    placeholder="Timeline (ex: Q3 2026 – Q1 2027)"
                    value={transitionData.timeline}
                    onChange={(e) =>
                      setTransitionData((d) => ({
                        ...d,
                        timeline: e.target.value,
                      }))
                    }
                  />
                  <Input
                    placeholder="Echipă responsabilă"
                    value={transitionData.team}
                    onChange={(e) =>
                      setTransitionData((d) => ({
                        ...d,
                        team: e.target.value,
                      }))
                    }
                  />
                  <Input
                    placeholder="Program lucrări (ex: L-V 07-19)"
                    value={transitionData.workingHours}
                    onChange={(e) =>
                      setTransitionData((d) => ({
                        ...d,
                        workingHours: e.target.value,
                      }))
                    }
                  />
                  <Input
                    type="date"
                    placeholder="Data start"
                    value={transitionData.startDate}
                    onChange={(e) =>
                      setTransitionData((d) => ({
                        ...d,
                        startDate: e.target.value,
                      }))
                    }
                  />
                  <Input
                    type="date"
                    placeholder="Data sfârșit"
                    value={transitionData.endDate}
                    onChange={(e) =>
                      setTransitionData((d) => ({
                        ...d,
                        endDate: e.target.value,
                      }))
                    }
                  />
                  <div className="md:col-span-2">
                    <textarea
                      placeholder="Descriere actualizată"
                      className="w-full bg-surface border border-border rounded-lg p-2 text-sm min-h-[60px] resize-none"
                      value={transitionData.description}
                      onChange={(e) =>
                        setTransitionData((d) => ({
                          ...d,
                          description: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setTransitionProject(null)}
                  >
                    Anulează
                  </Button>
                  <Button
                    size="sm"
                    variant="accent"
                    onClick={handleTransitionSubmit}
                    disabled={transitioning}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                    {transitioning
                      ? "Se salvează..."
                      : "Trimite la consultare publică"}
                  </Button>
                </div>
              </GlassCard>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ─── Create from Scratch Modal ─── */}
      <AnimatePresence>
        {showCreateForm && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-[1100]"
              onClick={() => setShowCreateForm(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[1110] w-full max-w-md"
            >
              <GlassCard className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <PlusCircle className="h-4 w-4 text-accent" />
                      Proiect nou de la zero
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Creează un proiect gol și desenează infrastructura pe
                      hartă
                    </p>
                  </div>
                  <button
                    onClick={() => setShowCreateForm(false)}
                    className="p-1 rounded hover:bg-surface-light"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="space-y-3">
                  <Input
                    placeholder="Titlu proiect *"
                    value={createData.title}
                    onChange={(e) =>
                      setCreateData((d) => ({ ...d, title: e.target.value }))
                    }
                  />
                  <textarea
                    placeholder="Descriere scurtă"
                    className="w-full bg-surface border border-border rounded-lg p-2 text-sm min-h-[50px] resize-none"
                    value={createData.description}
                    onChange={(e) =>
                      setCreateData((d) => ({
                        ...d,
                        description: e.target.value,
                      }))
                    }
                  />
                  <select
                    value={createData.projectType}
                    onChange={(e) =>
                      setCreateData((d) => ({
                        ...d,
                        projectType: e.target.value,
                      }))
                    }
                    className="w-full bg-surface border border-border rounded-lg text-sm px-3 py-2 text-foreground"
                  >
                    {Object.entries(projectTypeLabels).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                  <Input
                    placeholder="Timeline (ex: Q1 2027)"
                    value={createData.timeline}
                    onChange={(e) =>
                      setCreateData((d) => ({
                        ...d,
                        timeline: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowCreateForm(false)}
                  >
                    Anulează
                  </Button>
                  <Button
                    size="sm"
                    variant="accent"
                    onClick={handleCreateFromScratch}
                    disabled={!createData.title}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Creează proiect
                  </Button>
                </div>
              </GlassCard>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </PageTransition>
  );
}

/** Estimate total line length in meters using Haversine */
function estimateLength(coords: [number, number][]): number {
  let total = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const [lat1, lng1] = coords[i];
    const [lat2, lng2] = coords[i + 1];
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    total += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  return total;
}
