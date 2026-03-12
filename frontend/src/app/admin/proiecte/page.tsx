"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import {
  GripVertical,
  Users,
  Heart,
  MessageSquare,
  X,
  MapPin,
  Calendar,
  Wallet,
  ChevronRight,
  ArrowRight,
  ArrowLeft,
  Hammer,
  FlaskConical,
  Shield,
  Accessibility,
  AlertTriangle,
  Clock,
  FileDown,
  FileText,
  CheckCircle2,
} from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { PageTransition } from "@/components/ui/page-transition";
import { projectStageConfig, projectTypeLabels } from "@/lib/mock-data";
import { useProjects, apiPost, apiPatch, apiDelete } from "@/lib/api";
import type { Project, ProjectStage, ProjectType } from "@/types";

const ProjectGeoMap = dynamic(() => import("@/components/ui/project-geo-map"), { ssr: false });

const columns: { stage: ProjectStage; label: string; color: string }[] = [
  { stage: "planificat", label: "Planificat", color: "#94a3b8" },
  { stage: "simulare", label: "Simulare", color: "#6366f1" },
  { stage: "testare", label: "Testare", color: "#14b8a6" },
  { stage: "consultare_publica", label: "Consultare publică", color: "#a855f7" },
  { stage: "proiectare", label: "Proiectare", color: "#3b82f6" },
  { stage: "aprobare", label: "Aprobare", color: "#00d4ff" },
  { stage: "in_lucru", label: "În lucru", color: "#f59e0b" },
  { stage: "finalizat", label: "Finalizat", color: "#a3e635" },
];

export default function AdminProjectsPage() {
  const { data: apiProjects, mutate } = useProjects();
  const projects = apiProjects || [];
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [transitionProject, setTransitionProject] = useState<Project | null>(null);
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

  const byStage = useMemo(() => {
    const map: Record<string, Project[]> = {
      planificat: [], simulare: [], testare: [], consultare_publica: [], proiectare: [],
      aprobare: [], in_lucru: [], finalizat: [],
    };
    projects.forEach((p) => {
      if (map[p.stage]) map[p.stage].push(p);
    });
    return map;
  }, [projects]);

  const moveProject = async (projectId: string, newStage: ProjectStage) => {
    // Intercept simulare→consultare_publica to show detail form
    if (newStage === "consultare_publica") {
      const proj = projects.find((p) => p.id === projectId) || selectedProject;
      if (proj && proj.stage === "simulare") {
        setTransitionProject(proj);
        setTransitionData({
          budget: proj.budget || "",
          timeline: proj.timeline || "",
          team: proj.team || "",
          startDate: proj.startDate ? proj.startDate.slice(0, 10) : "",
          endDate: proj.endDate ? proj.endDate.slice(0, 10) : "",
          workingHours: proj.workingHours || "",
          description: proj.description || "",
        });
        return;
      }
    }
    try {
      const label = projectStageConfig[newStage]?.label || newStage;
      await apiPatch(`/projects/${projectId}`, { stage: newStage, stageLabel: label });
      mutate();
      if (selectedProject?.id === projectId) {
        setSelectedProject((prev) =>
          prev ? { ...prev, stage: newStage, stageLabel: label } : null
        );
      }
    } catch (err: any) {
      alert(`Eroare la schimbarea statusului: ${err.message || "Eroare necunoscută"}`);
    }
  };

  const handleTransitionSubmit = async () => {
    if (!transitionProject) return;
    setTransitioning(true);
    try {
      const label = projectStageConfig["consultare_publica"]?.label || "Consultare publică";
      await apiPatch(`/projects/${transitionProject.id}`, {
        stage: "consultare_publica",
        stageLabel: label,
        budget: transitionData.budget || undefined,
        timeline: transitionData.timeline || undefined,
        team: transitionData.team || undefined,
        startDate: transitionData.startDate || undefined,
        endDate: transitionData.endDate || undefined,
        workingHours: transitionData.workingHours || undefined,
        description: transitionData.description || undefined,
      });
      mutate();
      if (selectedProject?.id === transitionProject.id) {
        setSelectedProject((prev) =>
          prev ? { ...prev, stage: "consultare_publica" as ProjectStage, stageLabel: label } : null
        );
      }
      setTransitionProject(null);
    } catch (err: any) {
      alert(`Eroare la trimiterea la consultare: ${err.message || "Eroare necunoscută"}`);
    } finally {
      setTransitioning(false);
    }
  };

  return (
    <PageTransition>
      <div className="h-[calc(100vh-3.5rem-2rem)] sm:h-[calc(100vh-3.5rem-3rem)] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold font-[family-name:var(--font-heading)]">
              Proiecte 
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Gestionează proiectele prin pipeline-ul de lucru
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{projects.length} proiecte total</span>
          </div>
        </div>

        {/* Transition Form Modal: Simulare → Consultare Publică */}
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
                        Completează detaliile pentru <span className="text-foreground font-medium">{transitionProject.title}</span>
                      </p>
                    </div>
                    <button onClick={() => setTransitionProject(null)} className="p-1 rounded hover:bg-surface-light">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Input placeholder="Buget (ex: 2.5M RON)" value={transitionData.budget} onChange={(e) => setTransitionData((d) => ({ ...d, budget: e.target.value }))} />
                    <Input placeholder="Timeline (ex: Q3 2026 – Q1 2027)" value={transitionData.timeline} onChange={(e) => setTransitionData((d) => ({ ...d, timeline: e.target.value }))} />
                    <Input placeholder="Echipă responsabilă" value={transitionData.team} onChange={(e) => setTransitionData((d) => ({ ...d, team: e.target.value }))} />
                    <Input placeholder="Program lucrări (ex: L-V 07-19)" value={transitionData.workingHours} onChange={(e) => setTransitionData((d) => ({ ...d, workingHours: e.target.value }))} />
                    <Input type="date" placeholder="Data start" value={transitionData.startDate} onChange={(e) => setTransitionData((d) => ({ ...d, startDate: e.target.value }))} />
                    <Input type="date" placeholder="Data sfârșit" value={transitionData.endDate} onChange={(e) => setTransitionData((d) => ({ ...d, endDate: e.target.value }))} />
                    <div className="md:col-span-2">
                      <textarea
                        placeholder="Descriere actualizată"
                        className="w-full bg-surface border border-border rounded-lg p-2 text-sm min-h-[60px] resize-none"
                        value={transitionData.description}
                        onChange={(e) => setTransitionData((d) => ({ ...d, description: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 mt-4">
                    <Button size="sm" variant="outline" onClick={() => setTransitionProject(null)}>Anulează</Button>
                    <Button size="sm" variant="accent" onClick={handleTransitionSubmit} disabled={transitioning}>
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                      {transitioning ? "Se salvează..." : "Trimite la consultare publică"}
                    </Button>
                  </div>
                </GlassCard>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Kanban Board */}
        <div className="flex-1 overflow-x-auto">
          <div className="flex gap-2 h-full min-w-max pb-2">
            {columns.map((col) => (
              <div
                key={col.stage}
                className="w-52 sm:w-60 flex flex-col glass rounded-xl border border-border shrink-0"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between p-2.5 border-b border-border">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: col.color }}
                    />
                    <span className="text-xs font-semibold">{col.label}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground bg-surface-light px-1.5 py-0.5 rounded-full">
                    {byStage[col.stage].length}
                  </span>
                </div>

                {/* Column Body */}
                <div className="flex-1 overflow-y-auto p-1.5 space-y-1.5">
                  <AnimatePresence mode="popLayout">
                    {byStage[col.stage].map((project) => (
                      <motion.div
                        key={project.id}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        onClick={() => setSelectedProject(project)}
                        className="cursor-pointer"
                      >
                        <div className="p-2.5 rounded-lg bg-surface/50 border border-border/50 hover:border-border hover:bg-surface-light transition-all group">
                          <div className="flex items-start gap-1.5">
                            <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 mt-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium line-clamp-2 leading-tight">
                                {project.title}
                              </p>
                              {project.projectType && (
                                <p className="text-[10px] text-primary mt-0.5">
                                  {projectTypeLabels[project.projectType] || project.projectType}
                                </p>
                              )}
                              <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground">
                                <span className="flex items-center gap-0.5">
                                  <Users className="h-2.5 w-2.5" />
                                  {project.followers}
                                </span>
                                <span className="flex items-center gap-0.5">
                                  <Heart className="h-2.5 w-2.5" />
                                  {project.likes}
                                </span>
                                <span className="flex items-center gap-0.5">
                                  <MessageSquare className="h-2.5 w-2.5" />
                                  {project.commentCount}
                                </span>
                              </div>
                              {project.budget && (
                                <p className="text-[10px] text-accent mt-1 font-medium">
                                  {project.budget}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {byStage[col.stage].length === 0 && (
                    <div className="flex items-center justify-center h-16 text-[10px] text-muted-foreground border border-dashed border-border/50 rounded-lg">
                      Gol
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Project Detail Drawer */}
        <AnimatePresence>
          {selectedProject && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed top-14 left-0 right-0 bottom-0 bg-black/50 z-[1050]"
                onClick={() => setSelectedProject(null)}
              />
              <motion.div
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.3}
                onDragEnd={(_, info) => {
                  if (info.offset.x > 100) setSelectedProject(null);
                }}
                className="fixed right-0 top-14 bottom-0 w-full max-w-lg glass-strong border-l border-border z-[1060] flex flex-col"
              >
                {/* Drawer Header */}
                <div className="flex items-center justify-between p-4 border-b border-border">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-bold font-[family-name:var(--font-heading)] line-clamp-1">
                      {selectedProject.title}
                    </h2>
                    {selectedProject.projectType && (
                      <p className="text-xs text-primary mt-0.5">
                        {projectTypeLabels[selectedProject.projectType] || selectedProject.projectType}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setSelectedProject(null)}
                    className="p-1.5 rounded-lg hover:bg-surface-light"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Drawer Body */}
                <div className="flex-1 overflow-y-auto p-4 space-y-5">
                  <p className="text-sm text-muted-foreground">{selectedProject.description}</p>

                  {/* Stage pipeline */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Pipeline</p>
                    <div className="flex gap-0.5">
                      {columns.map((col, i) => {
                        const currentIdx = columns.findIndex((c) => c.stage === selectedProject.stage);
                        const isReached = i <= currentIdx;
                        return (
                          <div key={col.stage} className="flex-1 flex flex-col items-center gap-0.5">
                            <div
                              className="h-2 w-full rounded-full transition-colors"
                              style={{
                                backgroundColor: col.color,
                                opacity: isReached ? 1 : 0.15,
                              }}
                            />
                            <span className="text-[8px] text-muted-foreground text-center leading-tight">
                              {col.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    {selectedProject.budget && (
                      <div className="flex items-center gap-2 text-sm">
                        <Wallet className="h-4 w-4 text-accent shrink-0" />
                        <div>
                          <p className="text-[10px] text-muted-foreground">Buget</p>
                          <p className="font-medium text-xs">{selectedProject.budget}</p>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-primary shrink-0" />
                      <div>
                        <p className="text-[10px] text-muted-foreground">Timeline</p>
                        <p className="font-medium text-xs">{selectedProject.timeline}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-warning shrink-0" />
                      <div>
                        <p className="text-[10px] text-muted-foreground">Locație</p>
                        <p className="font-medium text-xs">{selectedProject.address}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-[10px] text-muted-foreground">Urmăritori</p>
                        <p className="font-medium text-xs">{selectedProject.followers}</p>
                      </div>
                    </div>
                    {selectedProject.startDate && (
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-primary shrink-0" />
                        <div>
                          <p className="text-[10px] text-muted-foreground">Început</p>
                          <p className="font-medium text-xs">{new Date(selectedProject.startDate).toLocaleDateString("ro-RO")}</p>
                        </div>
                      </div>
                    )}
                    {selectedProject.endDate && (
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-warning shrink-0" />
                        <div>
                          <p className="text-[10px] text-muted-foreground">Termen</p>
                          <p className="font-medium text-xs">{new Date(selectedProject.endDate).toLocaleDateString("ro-RO")}</p>
                        </div>
                      </div>
                    )}
                    {selectedProject.workingHours && (
                      <div className="flex items-center gap-2 text-sm col-span-2">
                        <Clock className="h-4 w-4 text-accent shrink-0" />
                        <div>
                          <p className="text-[10px] text-muted-foreground">Program lucrări</p>
                          <p className="font-medium text-xs">{selectedProject.workingHours}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Simulation Results */}
                  {selectedProject.simulationResults && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Rezultate simulare</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-surface-light">
                          <Shield className="h-4 w-4 text-accent" />
                          <div>
                            <p className="text-[10px] text-muted-foreground">Siguranță</p>
                            <p className="text-sm font-bold">{selectedProject.simulationResults.safetyScore}/100</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-surface-light">
                          <MapPin className="h-4 w-4 text-primary" />
                          <div>
                            <p className="text-[10px] text-muted-foreground">Acoperire</p>
                            <p className="text-sm font-bold">{selectedProject.simulationResults.coveragePercent}%</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-surface-light">
                          <AlertTriangle className="h-4 w-4 text-warning" />
                          <div>
                            <p className="text-[10px] text-muted-foreground">Zone conflict</p>
                            <p className="text-sm font-bold">{selectedProject.simulationResults.conflictZones}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-surface-light">
                          <Accessibility className="h-4 w-4 text-purple-400" />
                          <div>
                            <p className="text-[10px] text-muted-foreground">Accesibilitate</p>
                            <p className="text-sm font-bold">{selectedProject.simulationResults.accessibilityScore}/100</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Engagement Score */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Scor implicare cetățeni</p>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-3 bg-surface-light rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
                          initial={{ width: 0 }}
                          animate={{
                            width: `${selectedProject.citizenEngagementScore}%`,
                          }}
                          transition={{ duration: 0.8 }}
                        />
                      </div>
                      <span className="text-sm font-bold text-accent">
                        {selectedProject.citizenEngagementScore}%
                      </span>
                    </div>
                  </div>

                  {/* GeoJSON Map */}
                  {selectedProject.geometry && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Geometrie proiect (GeoJSON)</p>
                      <ProjectGeoMap geometry={selectedProject.geometry} className="h-56 w-full rounded-lg" />
                    </div>
                  )}

                  {/* Workflow Actions */}
                  <div className="border-t border-border pt-4">
                    <p className="text-xs text-muted-foreground mb-2">Acțiune rapidă</p>
                    <WorkflowActions
                      project={selectedProject}
                      onMove={moveProject}
                    />
                  </div>

                  {/* Move to any Stage */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Mută la etapa</p>
                    <div className="flex flex-wrap gap-1.5">
                      {columns.map((col) => (
                        <button
                          key={col.stage}
                          disabled={col.stage === selectedProject.stage}
                          onClick={() => moveProject(selectedProject.id, col.stage)}
                          className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                            col.stage === selectedProject.stage
                              ? "border-border text-muted-foreground opacity-40 cursor-not-allowed"
                              : "border-border hover:border-foreground/20 text-foreground hover:bg-surface-light"
                          }`}
                        >
                          <span
                            className="inline-block h-2 w-2 rounded-full mr-1"
                            style={{ backgroundColor: col.color }}
                          />
                          {col.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </PageTransition>
  );
}

/* Contextual workflow actions based on current stage */
function WorkflowActions({ project, onMove }: { project: Project; onMove: (id: string, stage: ProjectStage) => void }) {
  const stage = project.stage;

  const nextMap: Partial<Record<ProjectStage, { label: string; target: ProjectStage; icon: typeof ArrowRight; color: string }>> = {
    planificat: { label: "Trimite la simulare", target: "simulare", icon: FlaskConical, color: "bg-indigo-500/15 text-indigo-400 hover:bg-indigo-500/25" },
    simulare: { label: "Trimite la testare", target: "testare", icon: FlaskConical, color: "bg-teal-500/15 text-teal-400 hover:bg-teal-500/25" },
    testare: { label: "Trimite la consultare publică", target: "consultare_publica", icon: Users, color: "bg-purple-500/15 text-purple-400 hover:bg-purple-500/25" },
    consultare_publica: { label: "Trimite la proiectare", target: "proiectare", icon: Hammer, color: "bg-blue-500/15 text-blue-400 hover:bg-blue-500/25" },
    proiectare: { label: "Trimite la aprobare", target: "aprobare", icon: Shield, color: "bg-cyan-500/15 text-cyan-400 hover:bg-cyan-500/25" },
    aprobare: { label: "Începe lucrările", target: "in_lucru", icon: Hammer, color: "bg-amber-500/15 text-amber-400 hover:bg-amber-500/25" },
    in_lucru: { label: "Finalizează proiectul", target: "finalizat", icon: ArrowRight, color: "bg-green-500/15 text-green-400 hover:bg-green-500/25" },
  };

  const prevMap: Partial<Record<ProjectStage, { label: string; target: ProjectStage }>> = {
    simulare: { label: "Înapoi la planificat", target: "planificat" },
    testare: { label: "Înapoi la simulare", target: "simulare" },
    consultare_publica: { label: "Înapoi la testare", target: "testare" },
    proiectare: { label: "Înapoi la consultare publică", target: "consultare_publica" },
    aprobare: { label: "Înapoi la proiectare", target: "proiectare" },
    in_lucru: { label: "Înapoi la aprobare", target: "aprobare" },
    finalizat: { label: "Înapoi la în lucru", target: "in_lucru" },
  };

  const next = nextMap[stage];
  const prev = prevMap[stage];

  return (
    <div className="flex flex-col gap-2">
      {prev && (
        <button
          onClick={() => onMove(project.id, prev.target)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all bg-red-500/10 text-red-400 hover:bg-red-500/20"
        >
          <ArrowLeft className="h-4 w-4" />
          {prev.label}
        </button>
      )}
      {next ? (
        <button
          onClick={() => onMove(project.id, next.target)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${next.color}`}
        >
          <next.icon className="h-4 w-4" />
          {next.label}
          <ChevronRight className="h-4 w-4 ml-auto" />
        </button>
      ) : (
        <p className="text-xs text-accent">Proiect finalizat!</p>
      )}
    </div>
  );
}
