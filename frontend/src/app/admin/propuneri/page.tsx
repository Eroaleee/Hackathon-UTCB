"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lightbulb,
  AlertTriangle,
  Search,
  Filter,
  X,
  MapPin,
  ThumbsUp,
  MessageSquare,
  Eye,
  ArrowRightLeft,
  ChevronDown,
  Calendar,
  User,
  FolderPlus,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { PageTransition } from "@/components/ui/page-transition";
import {
  proposalStatusConfig,
  reportStatusConfig,
  severityConfig,
  reportCategoryLabels,
  proposalCategoryLabels,
} from "@/lib/mock-data";
import { useProposals, useReports, apiPatch, apiPost } from "@/lib/api";
import type { Proposal, Report } from "@/types";

const ProjectGeoMap = dynamic(() => import("@/components/ui/project-geo-map"), { ssr: false });

/** Wrap raw GeoJSON geometry into a FeatureCollection so ProjectGeoMap can render it */
function toFeatureCollection(geometry: any): any {
  if (!geometry) return null;
  if (geometry.type === "FeatureCollection") return geometry;
  if (geometry.type === "Feature") return { type: "FeatureCollection", features: [geometry] };
  // Raw geometry (LineString, Point, Polygon, etc.)
  return { type: "FeatureCollection", features: [{ type: "Feature", geometry, properties: {} }] };
}

type Tab = "propuneri" | "rapoarte";

export default function AdminFeedbackPage() {
  const [tab, setTab] = useState<Tab>("propuneri");

  return (
    <PageTransition>
      <div className="h-[calc(100vh-3.5rem-2rem)] sm:h-[calc(100vh-3.5rem-3rem)] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold font-[family-name:var(--font-heading)]">
              Feedback cetățeni
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Gestionează propunerile și rapoartele primite de la cetățeni
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-1 p-1 glass rounded-xl mb-4 w-fit">
          <button
            onClick={() => setTab("propuneri")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === "propuneri"
                ? "bg-warning/15 text-warning border border-warning/30"
                : "text-muted-foreground hover:text-foreground hover:bg-surface-light"
            }`}
          >
            <Lightbulb className="h-4 w-4" />
            Propuneri
          </button>
          <button
            onClick={() => setTab("rapoarte")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === "rapoarte"
                ? "bg-destructive/15 text-destructive border border-destructive/30"
                : "text-muted-foreground hover:text-foreground hover:bg-surface-light"
            }`}
          >
            <AlertTriangle className="h-4 w-4" />
            Rapoarte
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {tab === "propuneri" ? <ProposalsTab /> : <ReportsTab />}
        </div>
      </div>
    </PageTransition>
  );
}

/* ========================================== */
/* Proposals Tab                              */
/* ========================================== */

function ProposalsTab() {
  const { data: proposals, mutate } = useProposals();
  const items = proposals || [];
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [selected, setSelected] = useState<Proposal | null>(null);
  const [converting, setConverting] = useState(false);

  const filtered = useMemo(() => {
    let list = items;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.address.toLowerCase().includes(q)
      );
    }
    if (statusFilter) list = list.filter((p) => p.status === statusFilter);
    return list;
  }, [items, search, statusFilter]);

  const handleStatusChange = async (id: string, status: string) => {
    await apiPatch(`/proposals/${id}`, { status });
    mutate();
    if (selected?.id === id) setSelected((prev) => (prev ? { ...prev, status: status as Proposal["status"] } : null));
  };

  const handleConvertToProject = async (proposal: Proposal) => {
    setConverting(true);
    try {
      await apiPost("/projects", {
        title: proposal.title,
        description: proposal.description,
        address: proposal.address,
        latitude: proposal.location.lat.toString(),
        longitude: proposal.location.lng.toString(),
        stage: "simulare",
        stageLabel: "Simulare",
        timeline: "De definit",
        proposalId: proposal.id,
        geometry: proposal.geometry || null,
        projectType: proposal.category === "pista_noua" ? "pista_biciclete" : proposal.category === "parcare_biciclete" ? "parcare_biciclete" : proposal.category === "semaforizare" ? "semaforizare" : "infrastructura_mixta",
      });
      await handleStatusChange(proposal.id, "in_implementare");
    } finally {
      setConverting(false);
    }
  };

  const statusCounts = useMemo(() => {
    const map: Record<string, number> = {};
    items.forEach((p) => {
      map[p.status] = (map[p.status] || 0) + 1;
    });
    return map;
  }, [items]);

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Caută propuneri..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-sm h-9"
          />
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setStatusFilter("")}
            className={`px-2.5 py-1.5 rounded-lg text-xs transition-all border ${
              !statusFilter ? "bg-warning/15 text-warning border-warning/30" : "text-muted-foreground border-border hover:bg-surface-light"
            }`}
          >
            Toate ({items.length})
          </button>
          {Object.entries(proposalStatusConfig).map(([key, cfg]) => (
            <button
              key={key}
              onClick={() => setStatusFilter(statusFilter === key ? "" : key)}
              className={`px-2.5 py-1.5 rounded-lg text-xs transition-all border ${
                statusFilter === key ? "bg-warning/15 text-warning border-warning/30" : "text-muted-foreground border-border hover:bg-surface-light"
              }`}
            >
              {cfg.label} ({statusCounts[key] || 0})
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <GlassCard className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="text-left p-3 font-medium">Propunere</th>
                <th className="text-left p-3 font-medium">Categorie</th>
                <th className="text-left p-3 font-medium">Voturi</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-left p-3 font-medium">Acțiuni</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-border/50 hover:bg-surface-light/50 cursor-pointer transition-colors"
                  onClick={() => setSelected(p)}
                >
                  <td className="p-3">
                    <p className="font-medium line-clamp-1">{p.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {p.address}
                    </p>
                  </td>
                  <td className="p-3">
                    <span className="text-xs px-2 py-1 rounded-lg bg-surface-light">
                      {proposalCategoryLabels[p.category] || p.category}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="flex items-center gap-1"><ThumbsUp className="h-3 w-3" /> {p.votes}</span>
                      <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" /> {p.commentCount}</span>
                    </div>
                  </td>
                  <td className="p-3">
                    <StatusBadge
                      label={proposalStatusConfig[p.status].label}
                      colorClass={proposalStatusConfig[p.status].color}
                    />
                  </td>
                  <td className="p-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-1">
                      {p.status === "in_analiza" && (
                        <>
                          <button
                            onClick={() => handleStatusChange(p.id, "aprobat")}
                            className="p-1.5 rounded-lg hover:bg-accent/20 text-accent transition-colors"
                            title="Aprobă"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleStatusChange(p.id, "respins")}
                            className="p-1.5 rounded-lg hover:bg-destructive/20 text-destructive transition-colors"
                            title="Respinge"
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        </>
                      )}
                      {p.status === "aprobat" && (
                        <button
                          onClick={() => handleConvertToProject(p)}
                          disabled={converting}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs bg-indigo-500/15 text-indigo-400 hover:bg-indigo-500/25 transition-colors"
                          title="Trimite propunerea la simulare"
                        >
                          <FolderPlus className="h-3.5 w-3.5" />
                          Simulare
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-muted-foreground text-sm">
                    Nicio propunere găsită
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </GlassCard>
      </div>

      {/* Detail Drawer */}
      <ProposalDrawer
        proposal={selected}
        onClose={() => setSelected(null)}
        onStatusChange={handleStatusChange}
        onConvert={handleConvertToProject}
        converting={converting}
      />
    </div>
  );
}

function ProposalDrawer({
  proposal,
  onClose,
  onStatusChange,
  onConvert,
  converting,
}: {
  proposal: Proposal | null;
  onClose: () => void;
  onStatusChange: (id: string, status: string) => void;
  onConvert: (p: Proposal) => void;
  converting: boolean;
}) {
  if (!proposal) return null;
  return (
    <AnimatePresence>
      <motion.div
        key="proposal-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed top-14 left-0 right-0 bottom-0 bg-black/50 z-[1050]"
        onClick={onClose}
      />
      <motion.div
        key="proposal-drawer"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed right-0 top-14 bottom-0 w-full max-w-md glass-strong border-l border-border z-[1060] flex flex-col"
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-bold line-clamp-1">{proposal.title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-light">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <User className="h-3.5 w-3.5" />
            <span>{proposal.authorName}</span>
            <span>•</span>
            <Calendar className="h-3.5 w-3.5" />
            <span>{new Date(proposal.createdAt).toLocaleDateString("ro-RO")}</span>
          </div>

          <StatusBadge label={proposalStatusConfig[proposal.status].label} colorClass={proposalStatusConfig[proposal.status].color} />

          <p className="text-sm">{proposal.description}</p>

          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            {proposal.address}
          </div>

          <div className="flex gap-3 text-sm">
            <span className="flex items-center gap-1"><ThumbsUp className="h-4 w-4 text-accent" /> {proposal.votes} voturi</span>
            <span className="flex items-center gap-1"><MessageSquare className="h-4 w-4 text-primary" /> {proposal.commentCount} comentarii</span>
          </div>

          <div className="text-xs text-muted-foreground">
            Categorie: <span className="text-foreground font-medium">{proposalCategoryLabels[proposal.category] || proposal.category}</span>
          </div>

          {/* Proposal Geometry Map */}
          {proposal.geometry && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">Geometrie propusă</p>
              <ProjectGeoMap geometry={toFeatureCollection(proposal.geometry)} className="h-56 w-full rounded-lg" />
            </div>
          )}

          {/* Status Actions */}
          <div className="border-t border-border pt-4 space-y-2">
            <p className="text-xs text-muted-foreground font-medium">Acțiuni</p>
            <div className="flex flex-wrap gap-2">
              {proposal.status === "in_analiza" && (
                <>
                  <Button size="sm" variant="accent" onClick={() => onStatusChange(proposal.id, "aprobat")}>
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Aprobă
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => onStatusChange(proposal.id, "respins")}>
                    <XCircle className="h-3.5 w-3.5 mr-1" /> Respinge
                  </Button>
                </>
              )}
              {proposal.status === "aprobat" && (
                <Button size="sm" variant="accent" onClick={() => onConvert(proposal)} disabled={converting}>
                  <FolderPlus className="h-3.5 w-3.5 mr-1" />
                  {converting ? "Se trimite..." : "Trimite la simulare"}
                </Button>
              )}
              {proposal.status === "respins" && (
                <Button size="sm" variant="outline" onClick={() => onStatusChange(proposal.id, "in_analiza")}>
                  <Clock className="h-3.5 w-3.5 mr-1" /> Redeschide
                </Button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ========================================== */
/* Reports Tab                                */
/* ========================================== */

function ReportsTab() {
  const { data: reports, mutate } = useReports();
  const items = reports || [];
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [selected, setSelected] = useState<Report | null>(null);

  const filtered = useMemo(() => {
    let list = items;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q) ||
          r.address.toLowerCase().includes(q)
      );
    }
    if (statusFilter) list = list.filter((r) => r.status === statusFilter);
    return list;
  }, [items, search, statusFilter]);

  const handleStatusChange = async (id: string, status: string) => {
    await apiPatch(`/reports/${id}/status`, { status });
    mutate();
    if (selected?.id === id) setSelected((prev) => (prev ? { ...prev, status: status as Report["status"] } : null));
  };

  const statusCounts = useMemo(() => {
    const map: Record<string, number> = {};
    items.forEach((r) => {
      map[r.status] = (map[r.status] || 0) + 1;
    });
    return map;
  }, [items]);

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Caută rapoarte..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-sm h-9"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          <button
            onClick={() => setStatusFilter("")}
            className={`px-2.5 py-1.5 rounded-lg text-xs transition-all border ${
              !statusFilter ? "bg-warning/15 text-warning border-warning/30" : "text-muted-foreground border-border hover:bg-surface-light"
            }`}
          >
            Toate ({items.length})
          </button>
          {Object.entries(reportStatusConfig).map(([key, cfg]) => (
            <button
              key={key}
              onClick={() => setStatusFilter(statusFilter === key ? "" : key)}
              className={`px-2.5 py-1.5 rounded-lg text-xs transition-all border ${
                statusFilter === key ? "bg-warning/15 text-warning border-warning/30" : "text-muted-foreground border-border hover:bg-surface-light"
              }`}
            >
              {cfg.label} ({statusCounts[key] || 0})
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <GlassCard className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="text-left p-3 font-medium">Raport</th>
                <th className="text-left p-3 font-medium">Categorie</th>
                <th className="text-left p-3 font-medium">Severitate</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-left p-3 font-medium">Acțiuni</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-border/50 hover:bg-surface-light/50 cursor-pointer transition-colors"
                  onClick={() => setSelected(r)}
                >
                  <td className="p-3">
                    <p className="font-medium line-clamp-1">{r.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {r.address}
                    </p>
                  </td>
                  <td className="p-3">
                    <span className="text-xs px-2 py-1 rounded-lg bg-surface-light">
                      {reportCategoryLabels[r.category] || r.category}
                    </span>
                  </td>
                  <td className="p-3">
                    <StatusBadge label={severityConfig[r.severity].label} colorClass={severityConfig[r.severity].color} />
                  </td>
                  <td className="p-3">
                    <StatusBadge label={reportStatusConfig[r.status].label} colorClass={reportStatusConfig[r.status].color} />
                  </td>
                  <td className="p-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-1">
                      {r.status === "trimis" && (
                        <button
                          onClick={() => handleStatusChange(r.id, "in_analiza")}
                          className="p-1.5 rounded-lg hover:bg-primary/20 text-primary transition-colors text-xs"
                          title="Trece în analiză"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      )}
                      {(r.status === "in_analiza" || r.status === "trimis") && (
                        <button
                          onClick={() => handleStatusChange(r.id, "in_lucru")}
                          className="p-1.5 rounded-lg hover:bg-warning/20 text-warning transition-colors text-xs"
                          title="Trece în lucru"
                        >
                          <ArrowRightLeft className="h-4 w-4" />
                        </button>
                      )}
                      {r.status === "in_lucru" && (
                        <button
                          onClick={() => handleStatusChange(r.id, "rezolvat")}
                          className="p-1.5 rounded-lg hover:bg-accent/20 text-accent transition-colors text-xs"
                          title="Marchează rezolvat"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-muted-foreground text-sm">
                    Niciun raport găsit
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </GlassCard>
      </div>

      {/* Detail Drawer */}
      <ReportDrawer report={selected} onClose={() => setSelected(null)} onStatusChange={handleStatusChange} />
    </div>
  );
}

function ReportDrawer({
  report,
  onClose,
  onStatusChange,
}: {
  report: Report | null;
  onClose: () => void;
  onStatusChange: (id: string, status: string) => void;
}) {
  if (!report) return null;
  const nextActions: { label: string; status: string; color: string }[] = [];
  if (report.status === "trimis") nextActions.push({ label: "Trece în analiză", status: "in_analiza", color: "primary" });
  if (report.status === "trimis" || report.status === "in_analiza") nextActions.push({ label: "Trece în lucru", status: "in_lucru", color: "warning" });
  if (report.status === "in_lucru") nextActions.push({ label: "Rezolvat", status: "rezolvat", color: "accent" });
  if (report.status !== "respins" && report.status !== "rezolvat") nextActions.push({ label: "Respinge", status: "respins", color: "destructive" });
  if (report.status === "respins") nextActions.push({ label: "Redeschide", status: "in_analiza", color: "primary" });

  return (
    <AnimatePresence>
      <motion.div
        key="report-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed top-14 left-0 right-0 bottom-0 bg-black/50 z-[1050]"
        onClick={onClose}
      />
      <motion.div
        key="report-drawer"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed right-0 top-14 bottom-0 w-full max-w-md glass-strong border-l border-border z-[1060] flex flex-col"
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-bold line-clamp-1">{report.title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-light">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            <span>{new Date(report.createdAt).toLocaleDateString("ro-RO")}</span>
            <span>•</span>
            <Eye className="h-3.5 w-3.5" />
            <span>{report.seenCount} vizualizări</span>
          </div>

          <div className="flex items-center gap-2">
            <StatusBadge label={reportStatusConfig[report.status].label} colorClass={reportStatusConfig[report.status].color} />
            <StatusBadge label={severityConfig[report.severity].label} colorClass={severityConfig[report.severity].color} />
          </div>

          <p className="text-sm">{report.description}</p>

          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            {report.address}
          </div>

          <div className="text-xs text-muted-foreground">
            Categorie: <span className="text-foreground font-medium">{reportCategoryLabels[report.category] || report.category}</span>
          </div>

          {/* Status Actions */}
          <div className="border-t border-border pt-4 space-y-2">
            <p className="text-xs text-muted-foreground font-medium">Acțiuni</p>
            <div className="flex flex-wrap gap-2">
              {nextActions.map((a) => (
                <Button
                  key={a.status}
                  size="sm"
                  variant={a.color === "destructive" ? "destructive" : a.color === "accent" ? "accent" : "outline"}
                  onClick={() => onStatusChange(report.id, a.status)}
                >
                  {a.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
