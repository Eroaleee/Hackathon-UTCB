"use client";

import { useState, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import {
  Layers,
  Plus,
  Trash2,
  Download,
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
  Send,
  Undo2,
  Play,
  Pause,
  RotateCcw,
  Shield,
  AlertTriangle,
  Accessibility,
  RefreshCw,
  FileDown,
  ArrowRight,
  Map,
  Activity,
} from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageTransition } from "@/components/ui/page-transition";
import {
  useInfrastructureLayers,
  useInfrastructureElements,
  useProjects,
  useSimulations,
  useSimulationBaseline,
  createScenario,
  deleteScenario,
  runScenario,
  apiPost,
  apiPatch,
  apiDelete,
} from "@/lib/api";
import { projectStageConfig, projectTypeLabels } from "@/lib/mock-data";
import type { InfrastructureType, Project, SimulationScenario } from "@/types";

/* ──────────────────────────────────────────
   Dynamic map imports
   ────────────────────────────────────────── */

interface InfraLayer {
  id: string;
  type: InfrastructureType;
  label: string;
  color: string;
  icon: string;
  visible: boolean;
  count: number;
}

interface SelectedElement {
  id: string;
  name: string;
  type: string;
  properties: Record<string, string>;
}

const InfraMap = dynamic<{
  layers: InfraLayer[];
  elements: any[];
  activeTool: string;
  onSelectElement: (el: SelectedElement) => void;
  onAddPoint?: (latlng: { lat: number; lng: number }) => void;
  onAddLine?: (coords: [number, number][]) => void;
  drawingLine: [number, number][];
  projectGeometry?: any;
}>(() => import("@/app/admin/infrastructura/infra-map").then((m) => m.default), { ssr: false });

const SimMap = dynamic<{
  variant: "current" | "future";
  scenarioChanges?: any;
  projectGeometry?: any;
}>(() => import("@/app/admin/simulare/sim-map").then((m) => m.default), { ssr: false });

/* ──────────────────────────────────────────
   Constants
   ────────────────────────────────────────── */

type DrawingTool = "select" | "point" | "line" | "polygon";
type PageTab = "editor" | "simulare";

const drawingTools: { tool: DrawingTool; icon: typeof MapPin; label: string }[] = [
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
  { key: "safetyScore", label: "Siguranță", icon: Shield, color: "#a3e635", suffix: "/100" },
  { key: "coveragePercent", label: "Acoperire", icon: MapPin, color: "#00d4ff", suffix: "%" },
  { key: "conflictZones", label: "Zone conflict", icon: AlertTriangle, color: "#f59e0b", suffix: "" },
  { key: "accessibilityScore", label: "Accesibilitate", icon: Accessibility, color: "#a855f7", suffix: "/100" },
];

/* ──────────────────────────────────────────
   Page Component
   ────────────────────────────────────────── */

export default function AdminInfraSimPage() {
  const [tab, setTab] = useState<PageTab>("editor");

  /* ── Shared data ── */
  const { data: apiLayers } = useInfrastructureLayers();
  const { data: apiElements, mutate: mutateElements } = useInfrastructureElements();
  const { data: apiProjects, mutate: mutateProjects } = useProjects();
  const { data: scenarios, mutate: mutateScenarios } = useSimulations();
  const { data: baselineData } = useSimulationBaseline();

  /* ── Project selector (shared) ── */
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [showProjectList, setShowProjectList] = useState(true);

  const projects = apiProjects ?? [];
  const eligibleProjects = useMemo(
    () => projects.filter((p) => ["planificat", "proiectare", "simulare", "testare"].includes(p.stage)),
    [projects],
  );
  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  /* ── Infrastructure / Editor state ── */
  const [layers, setLayers] = useState<InfraLayer[]>([]);
  const [layersInit, setLayersInit] = useState(false);
  const [activeTool, setActiveTool] = useState<DrawingTool>("select");
  const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null);
  const [editingProps, setEditingProps] = useState(false);
  const [editedProps, setEditedProps] = useState<Record<string, string>>({});
  const [editedName, setEditedName] = useState("");

  // Point creation
  const [showAddForm, setShowAddForm] = useState(false);
  const [pendingPoint, setPendingPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [newElementName, setNewElementName] = useState("");
  const [newElementLayerId, setNewElementLayerId] = useState("");

  // Line drawing
  const [drawingLine, setDrawingLine] = useState<[number, number][]>([]);
  const [showLineForm, setShowLineForm] = useState(false);
  const [lineName, setLineName] = useState("");
  const [lineLayerId, setLineLayerId] = useState("");

  /* ── Simulation state ── */
  const allScenarios = scenarios ?? [];
  const filteredScenarios = useMemo(() => {
    if (!selectedProjectId) return allScenarios;
    return allScenarios.filter((s) => s.projectId === selectedProjectId);
  }, [allScenarios, selectedProjectId]);

  const [activeScenario, setActiveScenario] = useState<SimulationScenario | null>(null);
  const [playing, setPlaying] = useState(false);
  const [timelineValue, setTimelineValue] = useState(50);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [runningId, setRunningId] = useState<string | null>(null);

  const baseline = baselineData ?? { safetyScore: 0, coveragePercent: 0, conflictZones: 0, accessibilityScore: 0 };

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
      })),
    );
    setLayersInit(true);
  }

  // Auto-select first scenario
  if (filteredScenarios.length > 0 && !activeScenario) {
    setActiveScenario(filteredScenarios[0]);
  }

  const elements = apiElements ?? [];
  const totalElements = useMemo(() => layers.reduce((s, l) => s + l.count, 0), [layers]);
  const toggleLayer = (id: string) =>
    setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l)));

  /* ────────────────────────────
     Infrastructure handlers
     ──────────────────────────── */

  const handleExport = () => {
    const scope = selectedProjectId ? elements.filter((el: any) => el.projectId === selectedProjectId) : elements;
    const features = scope.map((el: any) => ({
      type: "Feature",
      geometry: el.geometry,
      properties: { id: el.id, name: el.name, type: el.type, typeLabel: el.typeLabel, ...el.properties },
    }));
    const blob = new Blob([JSON.stringify({ type: "FeatureCollection", features }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = selectedProject
      ? `infra_${selectedProject.title.replace(/\s+/g, "_")}.geojson`
      : "infrastructura_export.geojson";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAddPoint = (latlng: { lat: number; lng: number }) => {
    setPendingPoint(latlng);
    setShowAddForm(true);
    setNewElementName("");
    setNewElementLayerId(layers[0]?.id || "");
  };

  const handleCreatePointElement = async () => {
    if (!pendingPoint || !newElementName || !newElementLayerId) return;
    const layer = layers.find((l) => l.id === newElementLayerId);
    await apiPost("/infrastructure", {
      layerId: newElementLayerId,
      type: layer?.type || "parcare_biciclete",
      typeLabel: layer?.label || "",
      name: newElementName,
      geometry: { type: "Point", coordinates: [pendingPoint.lng, pendingPoint.lat] },
      properties: {},
      projectId: selectedProjectId || undefined,
    });
    mutateElements();
    setShowAddForm(false);
    setPendingPoint(null);
  };

  const handleAddLine = (coords: [number, number][]) => setDrawingLine(coords);

  const handleFinishLine = () => {
    if (drawingLine.length < 2) return;
    setShowLineForm(true);
    setLineName("");
    setLineLayerId(layers.find((l) => l.type === "pista_biciclete")?.id || layers[0]?.id || "");
  };

  const handleCreateLineElement = async () => {
    if (drawingLine.length < 2 || !lineName || !lineLayerId) return;
    const layer = layers.find((l) => l.id === lineLayerId);
    const geoCoords = drawingLine.map(([lat, lng]) => [lng, lat]);
    await apiPost("/infrastructure", {
      layerId: lineLayerId,
      type: layer?.type || "pista_biciclete",
      typeLabel: layer?.label || "",
      name: lineName,
      geometry: { type: "LineString", coordinates: geoCoords },
      properties: { length: `${estimateLength(drawingLine).toFixed(0)}m` },
      projectId: selectedProjectId || undefined,
    });
    mutateElements();
    setShowLineForm(false);
    setDrawingLine([]);
  };

  const handleUndoLastPoint = () => setDrawingLine((p) => p.slice(0, -1));
  const handleCancelDraw = () => {
    setDrawingLine([]);
    setShowLineForm(false);
  };

  const handleSaveElement = async () => {
    if (!selectedElement) return;
    await apiPatch(`/infrastructure/${selectedElement.id}`, { name: editedName, properties: editedProps });
    mutateElements();
    setEditingProps(false);
    setSelectedElement({ ...selectedElement, name: editedName, properties: editedProps });
  };

  const handleDeleteElement = async () => {
    if (!selectedElement) return;
    await apiDelete(`/infrastructure/${selectedElement.id}`);
    mutateElements();
    setSelectedElement(null);
  };

  const handleSendToSimulation = async () => {
    if (!selectedProjectId) return;
    await apiPatch(`/projects/${selectedProjectId}`, {
      stage: "simulare",
      stageLabel: projectStageConfig["simulare"]?.label || "Simulare",
    });
    mutateProjects();
    setTab("simulare");
  };

  /* ────────────────────────────
     Simulation handlers
     ──────────────────────────── */

  const handleCreateScenario = useCallback(async () => {
    const name = newName.trim() || (selectedProject ? `Simulare: ${selectedProject.title}` : "");
    if (!name) return;
    try {
      const created = await createScenario({
        name,
        ...(selectedProjectId ? { projectId: selectedProjectId } : {}),
      });
      await mutateScenarios();
      setActiveScenario(created);
      setNewName("");
      setCreating(false);
    } catch (e) {
      console.error("Failed to create scenario", e);
    }
  }, [newName, selectedProjectId, selectedProject, mutateScenarios]);

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
    [activeScenario, mutateScenarios],
  );

  const handleRerun = useCallback(
    async (id: string) => {
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
    },
    [mutateScenarios],
  );

  const handleExportScenario = () => {
    if (!activeScenario) return;
    const blob = new Blob(
      [
        JSON.stringify(
          {
            type: "FeatureCollection",
            features: activeScenario.changes?.features || [],
            properties: { scenarioName: activeScenario.name, metrics: activeScenario.metrics },
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `simulare_${activeScenario.name.replace(/\s+/g, "_")}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSendToTestare = async () => {
    if (!selectedProjectId || !activeScenario) return;
    await apiPatch(`/projects/${selectedProjectId}`, {
      stage: "testare",
      stageLabel: projectStageConfig["testare"]?.label || "Testare",
      simulationResults: activeScenario.metrics,
    });
    mutateProjects();
  };

  const handleQuickSimulate = async (project: Project) => {
    setSelectedProjectId(project.id);
    try {
      const created = await createScenario({
        name: `Simulare: ${project.title}`,
        ...(project.id ? { projectId: project.id } : {}),
      });
      await mutateScenarios();
      setActiveScenario(created);
    } catch (e) {
      console.error("Failed", e);
    }
  };

  /* ──────────────────────────────────────────
     RENDER
     ────────────────────────────────────────── */

  return (
    <PageTransition>
      <div className="h-[calc(100vh-3.5rem-2rem)] sm:h-[calc(100vh-3.5rem-3rem)] flex flex-col">
        {/* Header + Tab Switcher */}
        <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <h1 className="text-xl sm:text-2xl font-bold font-[family-name:var(--font-heading)]">
              Infrastructură & Simulare
            </h1>
            <div className="flex rounded-xl bg-surface-light border border-border p-0.5">
              <button
                onClick={() => setTab("editor")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  tab === "editor"
                    ? "bg-warning/20 text-warning shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Map className="h-3.5 w-3.5" /> Editor
              </button>
              <button
                onClick={() => setTab("simulare")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  tab === "simulare"
                    ? "bg-warning/20 text-warning shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Activity className="h-3.5 w-3.5" /> Simulare
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            {tab === "editor" && (
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 mr-1" /> Export GeoJSON
              </Button>
            )}
            {tab === "simulare" && activeScenario && (
              <Button variant="outline" size="sm" onClick={handleExportScenario}>
                <FileDown className="h-4 w-4 mr-1" /> Export GeoJSON
              </Button>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 flex flex-col lg:flex-row gap-3 min-h-0 overflow-hidden">
          {/* ─── Left Panel ─── */}
          <div className="w-full lg:w-72 shrink-0 flex flex-col gap-3 overflow-y-auto">
            {/* Project Selector (shared) */}
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
                    <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
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
                        {tab === "editor" ? "Toate elementele" : "Toate scenariile"}
                      </button>
                      {eligibleProjects.map((p) => (
                        <div
                          key={p.id}
                          className={`flex items-center gap-1 p-2 rounded-lg text-xs transition-all ${
                            selectedProjectId === p.id
                              ? "bg-warning/10 text-warning border border-warning/30"
                              : "text-muted-foreground hover:bg-surface-light hover:text-foreground"
                          }`}
                        >
                          <button
                            onClick={() => {
                              setSelectedProjectId(p.id);
                              setActiveScenario(null);
                            }}
                            className="flex-1 text-left min-w-0"
                          >
                            <p className="font-medium text-foreground line-clamp-1">{p.title}</p>
                            <div className="flex items-center gap-1 mt-0.5">
                              <span
                                className="h-1.5 w-1.5 rounded-full shrink-0"
                                style={{
                                  backgroundColor:
                                    p.stage === "planificat"
                                      ? "#71717a"
                                      : p.stage === "proiectare"
                                        ? "#3b82f6"
                                        : p.stage === "simulare"
                                          ? "#6366f1"
                                          : "#f97316",
                                }}
                              />
                              <span>{projectStageConfig[p.stage]?.label || p.stage}</span>
                              {p.projectType && (
                                <span className="ml-1">• {projectTypeLabels[p.projectType] || ""}</span>
                              )}
                            </div>
                          </button>
                          {/* Quick simulate shortcut */}
                          {tab === "simulare" &&
                            p.geometry &&
                            !filteredScenarios.some((s) => s.projectId === p.id) && (
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
                  </motion.div>
                )}
              </AnimatePresence>
            </GlassCard>

            {/* ─── Editor-specific controls ─── */}
            {tab === "editor" && (
              <>
                {/* Drawing Toolbar */}
                <GlassCard className="p-3">
                  <p className="text-xs text-muted-foreground mb-2 font-medium">Instrumente</p>
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
                  {/* Line drawing controls */}
                  {activeTool === "line" && drawingLine.length > 0 && (
                    <div className="mt-2 flex gap-1.5">
                      <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={handleUndoLastPoint}>
                        <Undo2 className="h-3 w-3 mr-1" /> Înapoi
                      </Button>
                      {drawingLine.length >= 2 && (
                        <Button size="sm" variant="accent" className="flex-1 text-xs" onClick={handleFinishLine}>
                          <Check className="h-3 w-3 mr-1" /> Gata
                        </Button>
                      )}
                      <Button size="sm" variant="destructive" className="text-xs" onClick={handleCancelDraw}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                  {activeTool === "line" && drawingLine.length === 0 && (
                    <p className="text-[10px] text-muted-foreground mt-2">
                      Click pe hartă pentru a adăuga puncte. Apasă &quot;Gata&quot; când termini.
                    </p>
                  )}
                </GlassCard>

                {/* Layer Manager */}
                <GlassCard className="p-3 flex-1 flex flex-col min-h-0">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Layers className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-semibold">Straturi</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{totalElements} elem.</span>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-0.5 -mx-1 px-1">
                    {layers.map((layer) => (
                      <div
                        key={layer.id}
                        className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-surface-light transition-colors"
                      >
                        <button onClick={() => toggleLayer(layer.id)} className="shrink-0">
                          {layer.visible ? (
                            <Eye className="h-3.5 w-3.5 text-foreground" />
                          ) : (
                            <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </button>
                        <div
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: layer.color }}
                        />
                        <span
                          className={`text-xs flex-1 truncate ${layer.visible ? "text-foreground" : "text-muted-foreground"}`}
                        >
                          {layer.label}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{layer.count}</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-border pt-2 mt-2 flex flex-col gap-1.5">
                    {selectedProject && selectedProject.stage === "proiectare" && (
                      <Button
                        size="sm"
                        variant="accent"
                        className="w-full text-xs"
                        onClick={handleSendToSimulation}
                      >
                        <Send className="h-3 w-3 mr-1" /> Trimite la simulare
                      </Button>
                    )}
                  </div>
                </GlassCard>

                {/* Properties Panel */}
                <AnimatePresence>
                  {selectedElement && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                    >
                      <GlassCard className="p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold">Proprietăți</span>
                          <div className="flex gap-1">
                            {editingProps ? (
                              <button onClick={handleSaveElement} className="p-1 rounded hover:bg-surface-light">
                                <Check className="h-3.5 w-3.5 text-accent" />
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  setEditingProps(true);
                                  setEditedName(selectedElement.name);
                                  setEditedProps({ ...selectedElement.properties });
                                }}
                                className="p-1 rounded hover:bg-surface-light"
                              >
                                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                              </button>
                            )}
                            <button
                              onClick={handleDeleteElement}
                              className="p-1 rounded hover:bg-destructive/20"
                              title="Șterge"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </button>
                            <button
                              onClick={() => setSelectedElement(null)}
                              className="p-1 rounded hover:bg-surface-light"
                            >
                              <X className="h-3.5 w-3.5 text-muted-foreground" />
                            </button>
                          </div>
                        </div>
                        <div className="space-y-2 text-xs">
                          <div>
                            <span className="text-muted-foreground">Nume</span>
                            {editingProps ? (
                              <Input
                                value={editedName}
                                onChange={(e) => setEditedName(e.target.value)}
                                className="text-xs mt-0.5 h-7"
                              />
                            ) : (
                              <p className="font-medium">{selectedElement.name}</p>
                            )}
                          </div>
                          <div>
                            <span className="text-muted-foreground">Tip</span>
                            <p className="font-medium">{selectedElement.type}</p>
                          </div>
                          {Object.entries(editingProps ? editedProps : selectedElement.properties).map(([k, v]) => (
                            <div key={k}>
                              <span className="text-muted-foreground">{k}</span>
                              {editingProps ? (
                                <Input
                                  value={editedProps[k] || ""}
                                  onChange={(e) =>
                                    setEditedProps((prev) => ({ ...prev, [k]: e.target.value }))
                                  }
                                  className="text-xs mt-0.5 h-7"
                                />
                              ) : (
                                <p className="font-medium">{v}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </GlassCard>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Add Point Form */}
                <AnimatePresence>
                  {showAddForm && pendingPoint && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                    >
                      <GlassCard className="p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold">Punct nou</span>
                          <button
                            onClick={() => {
                              setShowAddForm(false);
                              setPendingPoint(null);
                            }}
                            className="p-1 rounded hover:bg-surface-light"
                          >
                            <X className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                        </div>
                        <div className="space-y-2 text-xs">
                          <p className="text-muted-foreground">
                            Lat: {pendingPoint.lat.toFixed(5)}, Lng: {pendingPoint.lng.toFixed(5)}
                          </p>
                          <Input
                            placeholder="Nume"
                            value={newElementName}
                            onChange={(e) => setNewElementName(e.target.value)}
                            className="text-xs h-7"
                          />
                          <select
                            value={newElementLayerId}
                            onChange={(e) => setNewElementLayerId(e.target.value)}
                            className="w-full bg-surface border border-border rounded-lg text-xs px-2 py-1.5 text-foreground"
                          >
                            {layers.map((l) => (
                              <option key={l.id} value={l.id}>
                                {l.label}
                              </option>
                            ))}
                          </select>
                          <Button
                            size="sm"
                            variant="accent"
                            className="w-full text-xs"
                            onClick={handleCreatePointElement}
                            disabled={!newElementName}
                          >
                            <Plus className="h-3 w-3 mr-1" /> Adaugă
                          </Button>
                        </div>
                      </GlassCard>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Add Line Form */}
                <AnimatePresence>
                  {showLineForm && drawingLine.length >= 2 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                    >
                      <GlassCard className="p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold">Linie nouă</span>
                          <button onClick={handleCancelDraw} className="p-1 rounded hover:bg-surface-light">
                            <X className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                        </div>
                        <div className="space-y-2 text-xs">
                          <p className="text-muted-foreground">
                            {drawingLine.length} puncte • ~{estimateLength(drawingLine).toFixed(0)}m
                          </p>
                          <Input
                            placeholder="Nume (ex: Pistă Bd. Lacul Tei)"
                            value={lineName}
                            onChange={(e) => setLineName(e.target.value)}
                            className="text-xs h-7"
                          />
                          <select
                            value={lineLayerId}
                            onChange={(e) => setLineLayerId(e.target.value)}
                            className="w-full bg-surface border border-border rounded-lg text-xs px-2 py-1.5 text-foreground"
                          >
                            {layers.map((l) => (
                              <option key={l.id} value={l.id}>
                                {l.label}
                              </option>
                            ))}
                          </select>
                          <Button
                            size="sm"
                            variant="accent"
                            className="w-full text-xs"
                            onClick={handleCreateLineElement}
                            disabled={!lineName}
                          >
                            <Plus className="h-3 w-3 mr-1" /> Salvează linia
                          </Button>
                        </div>
                      </GlassCard>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}

            {/* ─── Simulation-specific controls ─── */}
            {tab === "simulare" && (
              <>
                {/* Scenario List */}
                <GlassCard className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-muted-foreground font-medium">Scenarii</p>
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
                          selectedProject ? `Simulare: ${selectedProject.title}` : "Nume scenariu..."
                        }
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleCreateScenario()}
                      />
                      <Button size="sm" variant="outline" onClick={handleCreateScenario} className="text-xs h-7">
                        OK
                      </Button>
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
                      <p className="text-[10px] text-center py-3 text-muted-foreground">
                        {selectedProjectId ? "Nicio simulare. Creează una." : "Niciun scenariu."}
                      </p>
                    )}
                  </div>
                </GlassCard>

                {/* Metrics Comparison */}
                <GlassCard className="p-3 flex-1">
                  <p className="text-xs text-muted-foreground font-medium mb-3">Metrici</p>
                  <div className="space-y-3">
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
                              {current} <ChevronRight className="inline h-3 w-3" /> {future}
                              {m.suffix}
                            </span>
                          </div>
                          <div className="flex gap-1 h-2">
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

                {/* Playback + Actions */}
                <GlassCard className="p-3">
                  <div className="flex items-center gap-2">
                    <Button size="icon" variant="ghost" onClick={() => setPlaying(!playing)} className="h-8 w-8">
                      {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setTimelineValue(0);
                        setPlaying(false);
                      }}
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
                    <Button
                      size="sm"
                      variant="accent"
                      className="w-full mt-2 text-xs"
                      onClick={handleSendToTestare}
                    >
                      <ArrowRight className="h-3.5 w-3.5 mr-1" /> Trimite la testare
                    </Button>
                  )}
                </GlassCard>
              </>
            )}
          </div>

          {/* ─── Map Area ─── */}
          {tab === "editor" && (
            <div className="flex-1 rounded-xl overflow-hidden border border-border relative min-h-[400px]">
              <InfraMap
                layers={layers}
                elements={elements}
                activeTool={activeTool}
                onSelectElement={(el) => {
                  setSelectedElement(el);
                  setEditingProps(false);
                  setEditedName(el.name);
                  setEditedProps({ ...el.properties });
                }}
                onAddPoint={handleAddPoint}
                onAddLine={handleAddLine}
                drawingLine={drawingLine}
                projectGeometry={selectedProject?.geometry}
              />
              {/* Floating info */}
              <div className="absolute top-3 right-3 glass rounded-lg px-3 py-1.5 text-xs flex items-center gap-2 z-[1000]">
                <div className="h-2 w-2 rounded-full bg-accent animate-pulse" />
                Mod:{" "}
                <span className="font-medium text-warning">
                  {drawingTools.find((t) => t.tool === activeTool)?.label}
                </span>
              </div>
              {selectedProject && (
                <div className="absolute top-3 left-3 glass rounded-lg px-3 py-1.5 text-xs z-[1000]">
                  <span className="text-muted-foreground">Proiect: </span>
                  <span className="font-medium text-primary">{selectedProject.title}</span>
                </div>
              )}
            </div>
          )}

          {tab === "simulare" && (
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2 min-h-[400px]">
              <div className="rounded-xl overflow-hidden border border-border relative">
                <div className="absolute top-3 left-3 z-[1000] glass rounded-lg px-3 py-1.5 text-xs font-medium flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Situația curentă
                </div>
                <SimMap variant="current" />
              </div>
              <div className="rounded-xl overflow-hidden border border-border relative">
                <div className="absolute top-3 left-3 z-[1000] glass rounded-lg px-3 py-1.5 text-xs font-medium flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-green-500" /> Scenariu:{" "}
                  {activeScenario?.name ?? "—"}
                </div>
                <SimMap
                  variant="future"
                  scenarioChanges={activeScenario?.changes}
                  projectGeometry={selectedProject?.geometry}
                />
              </div>
            </div>
          )}
        </div>
      </div>
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
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    total += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  return total;
}
