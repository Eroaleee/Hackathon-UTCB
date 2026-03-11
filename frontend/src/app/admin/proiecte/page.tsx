"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import {
  GripVertical,
  Clock,
  Users,
  Heart,
  MessageSquare,
  ChevronRight,
  X,
  MapPin,
  Calendar,
  Wallet,
  Eye,
  EyeOff,
  Plus,
} from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { PageTransition } from "@/components/ui/page-transition";
import { projectStageConfig } from "@/lib/mock-data";
import { useProjects, apiPost, apiPatch, apiDelete } from "@/lib/api";
import type { Project, ProjectStage } from "@/types";

const ProjectGeoMap = dynamic(() => import("@/components/ui/project-geo-map"), { ssr: false });

const columns: { stage: ProjectStage; label: string; color: string }[] = [
  { stage: "planificat", label: "Planificat", color: "#71717a" },
  { stage: "consultare_publica", label: "Consultare publică", color: "#a855f7" },
  { stage: "aprobare", label: "Aprobare", color: "#00d4ff" },
  { stage: "in_lucru", label: "În lucru", color: "#f59e0b" },
  { stage: "finalizat", label: "Finalizat", color: "#a3e635" },
];

export default function AdminProjectsPage() {
  const { data: apiProjects, mutate } = useProjects();
  const projects = apiProjects || [];
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newProject, setNewProject] = useState({
    title: "",
    description: "",
    budget: "",
    timeline: "",
    team: "",
    address: "",
    latitude: "44.4505",
    longitude: "26.1200",
  });

  const byStage = useMemo(() => {
    const map: Record<ProjectStage, Project[]> = {
      planificat: [],
      consultare_publica: [],
      aprobare: [],
      in_lucru: [],
      finalizat: [],
    };
    projects.forEach((p) => map[p.stage].push(p));
    return map;
  }, [projects]);

  const moveProject = async (projectId: string, newStage: ProjectStage) => {
    const label = projectStageConfig[newStage].label;
    await apiPatch(`/projects/${projectId}`, { stage: newStage, stageLabel: label });
    mutate();
    if (selectedProject?.id === projectId) {
      setSelectedProject((prev) =>
        prev
          ? { ...prev, stage: newStage, stageLabel: label }
          : null
      );
    }
  };

  const handleCreateProject = async () => {
    if (!newProject.title || !newProject.description || !newProject.timeline || !newProject.address) return;
    setCreating(true);
    try {
      await apiPost("/projects", {
        ...newProject,
        stage: "planificat",
        stageLabel: "Planificat",
      });
      mutate();
      setShowCreateForm(false);
      setNewProject({ title: "", description: "", budget: "", timeline: "", team: "", address: "", latitude: "44.4505", longitude: "26.1200" });
    } finally {
      setCreating(false);
    }
  };

  return (
    <PageTransition>
      <div className="h-[calc(100vh-3.5rem-2rem)] sm:h-[calc(100vh-3.5rem-3rem)] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold font-[family-name:var(--font-heading)]">
              Proiecte — Kanban
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Gestionează și mută proiectele între etape
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{projects.length} proiecte total</span>
            <Button size="sm" variant="accent" className="text-xs" onClick={() => setShowCreateForm(true)}>
              <Plus className="h-3 w-3 mr-1" /> Proiect nou
            </Button>
          </div>
        </div>

        {/* Create Project Form */}
        <AnimatePresence>
          {showCreateForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4"
            >
              <GlassCard className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold">Proiect nou</h3>
                  <button onClick={() => setShowCreateForm(false)} className="p-1 rounded hover:bg-surface-light">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input placeholder="Titlu *" value={newProject.title} onChange={(e) => setNewProject((p) => ({ ...p, title: e.target.value }))} />
                  <Input placeholder="Timeline * (ex: Q3 2025 – Q1 2026)" value={newProject.timeline} onChange={(e) => setNewProject((p) => ({ ...p, timeline: e.target.value }))} />
                  <Input placeholder="Adresa *" value={newProject.address} onChange={(e) => setNewProject((p) => ({ ...p, address: e.target.value }))} />
                  <Input placeholder="Buget (opțional)" value={newProject.budget} onChange={(e) => setNewProject((p) => ({ ...p, budget: e.target.value }))} />
                  <Input placeholder="Echipă (opțional)" value={newProject.team} onChange={(e) => setNewProject((p) => ({ ...p, team: e.target.value }))} />
                  <div className="flex gap-2">
                    <Input placeholder="Latitudine" value={newProject.latitude} onChange={(e) => setNewProject((p) => ({ ...p, latitude: e.target.value }))} />
                    <Input placeholder="Longitudine" value={newProject.longitude} onChange={(e) => setNewProject((p) => ({ ...p, longitude: e.target.value }))} />
                  </div>
                  <div className="md:col-span-2">
                    <textarea
                      placeholder="Descriere *"
                      className="w-full bg-surface border border-border rounded-lg p-2 text-sm min-h-[60px] resize-none"
                      value={newProject.description}
                      onChange={(e) => setNewProject((p) => ({ ...p, description: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="flex justify-end mt-3">
                  <Button size="sm" variant="accent" onClick={handleCreateProject} disabled={creating || !newProject.title || !newProject.description || !newProject.timeline || !newProject.address}>
                    {creating ? "Se creează..." : "Creează proiect"}
                  </Button>
                </div>
              </GlassCard>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Kanban Board */}
        <div className="flex-1 overflow-x-auto">
          <div className="flex gap-3 h-full min-w-max pb-2">
            {columns.map((col) => (
              <div
                key={col.stage}
                className="w-60 sm:w-72 flex flex-col glass rounded-xl border border-border shrink-0"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between p-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: col.color }}
                    />
                    <span className="text-sm font-semibold">{col.label}</span>
                  </div>
                  <span className="text-xs text-muted-foreground bg-surface-light px-2 py-0.5 rounded-full">
                    {byStage[col.stage].length}
                  </span>
                </div>

                {/* Column Body */}
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
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
                        <div className="p-3 rounded-lg bg-surface/50 border border-border/50 hover:border-border hover:bg-surface-light transition-all group">
                          <div className="flex items-start gap-2">
                            <GripVertical className="h-4 w-4 text-muted-foreground/40 mt-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium line-clamp-2 leading-tight">
                                {project.title}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {project.description}
                              </p>
                              <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Users className="h-3 w-3" />
                                  {project.followers}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Heart className="h-3 w-3" />
                                  {project.likes}
                                </span>
                                <span className="flex items-center gap-1">
                                  <MessageSquare className="h-3 w-3" />
                                  {project.commentCount}
                                </span>
                              </div>
                              {project.budget && (
                                <p className="text-[10px] text-accent mt-1.5 font-medium">
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
                    <div className="flex items-center justify-center h-20 text-xs text-muted-foreground border border-dashed border-border/50 rounded-lg">
                      Niciun proiect
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
                className="fixed inset-0 bg-black/50 z-[1050]"
                onClick={() => setSelectedProject(null)}
              />
              <motion.div
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="fixed right-0 top-0 h-full w-full max-w-md glass-strong border-l border-border z-[1060] flex flex-col"
              >
                {/* Drawer Header */}
                <div className="flex items-center justify-between p-4 border-b border-border">
                  <h2 className="text-lg font-bold font-[family-name:var(--font-heading)] line-clamp-1">
                    {selectedProject.title}
                  </h2>
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

                  {/* Stage indicator */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Etapă curentă</p>
                    <div className="flex gap-1">
                      {columns.map((col) => (
                        <div key={col.stage} className="flex-1 flex flex-col items-center gap-1">
                          <div
                            className={`h-2 w-full rounded-full transition-colors ${
                              columns.findIndex((c) => c.stage === selectedProject.stage) >=
                              columns.findIndex((c) => c.stage === col.stage)
                                ? ""
                                : "opacity-20"
                            }`}
                            style={{
                              backgroundColor: col.color,
                              opacity:
                                columns.findIndex((c) => c.stage === selectedProject.stage) >=
                                columns.findIndex((c) => c.stage === col.stage)
                                  ? 1
                                  : 0.15,
                            }}
                          />
                          <span className="text-[9px] text-muted-foreground text-center">
                            {col.label}
                          </span>
                        </div>
                      ))}
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
                  </div>

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
                      <p className="text-xs text-muted-foreground mb-2">Modificări propuse (GeoJSON)</p>
                      <ProjectGeoMap geometry={selectedProject.geometry} className="h-56 w-full rounded-lg" />
                    </div>
                  )}

                  {/* Move to Stage */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Mută la etapa</p>
                    <div className="flex flex-wrap gap-1.5">
                      {columns.map((col) => (
                        <button
                          key={col.stage}
                          disabled={col.stage === selectedProject.stage}
                          onClick={() => moveProject(selectedProject.id, col.stage)}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                            col.stage === selectedProject.stage
                              ? "border-border text-muted-foreground opacity-40 cursor-not-allowed"
                              : "border-border hover:border-foreground/20 text-foreground hover:bg-surface-light"
                          }`}
                        >
                          <span
                            className="inline-block h-2 w-2 rounded-full mr-1.5"
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
