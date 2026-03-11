"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import {
  ThumbsUp,
  ThumbsDown,
  MessageCircle,
  Send,
  MapPin,
  PartyPopper,
  Reply,
  X,
  Shield,
  User,
  Calendar,
  Eye,
  Ruler,
  MousePointer2,
  Undo2,
  Check,
  Trash2,
  Circle,
  Layers,
  Map as MapIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/input";
import { GlassCard } from "@/components/ui/glass-card";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  PageTransition,
  StaggerContainer,
  StaggerItem,
} from "@/components/ui/page-transition";
import { EmptyState } from "@/components/ui/empty-state";
import {
  proposalCategoryLabels,
  proposalStatusConfig,
} from "@/lib/mock-data";
import { useProposals, useInfrastructureLayers, useInfrastructureElements, apiPost } from "@/lib/api";
import type { Proposal, ProposalCategory, Comment } from "@/types";
import { cn } from "@/lib/utils";

const LocationPickerMap = dynamic(
  () => import("@/components/ui/location-picker-map"),
  { ssr: false }
);

const ProposalDrawMap = dynamic(
  () => import("@/components/ui/proposal-draw-map"),
  { ssr: false }
);

type DrawTool = "select" | "point" | "line";

const drawToolButtons: { id: DrawTool; label: string; icon: React.ElementType }[] = [
  { id: "select", label: "Locație", icon: MousePointer2 },
  { id: "line", label: "Traseu", icon: Ruler },
  { id: "point", label: "Punct", icon: Circle },
];

type Tab = "exploreaza" | "trimite";
type SortBy = "votes" | "recent" | "trending";

const categoryOptions: { id: ProposalCategory; label: string }[] = [
  { id: "pista_noua", label: "Pistă nouă" },
  { id: "parcare_biciclete", label: "Parcare biciclete" },
  { id: "siguranta", label: "Siguranță" },
  { id: "semaforizare", label: "Semaforizare" },
  { id: "infrastructura_verde", label: "Infrastructură verde" },
  { id: "altele", label: "Altele" },
];

export default function PropuneriPage() {
  const [tab, setTab] = useState<Tab>("exploreaza");
  const [sortBy, setSortBy] = useState<SortBy>("recent");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const { data: proposals = [], mutate } = useProposals();
  const { data: rawLayers = [] } = useInfrastructureLayers();
  const { data: infraElements = [] } = useInfrastructureElements();
  const [expandedComments, setExpandedComments] = useState<string | null>(null);
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [detailVisibleLayers, setDetailVisibleLayers] = useState<Set<string>>(new Set());
  const [showLayerPanel, setShowLayerPanel] = useState(false);

  // Build infra layers with visibility from toggle state, default all visible on first load
  const infraLayers = rawLayers.map((l) => ({
    id: l.id,
    type: l.type,
    label: l.label,
    color: l.color,
    visible: detailVisibleLayers.size === 0 ? l.isDefaultVisible : detailVisibleLayers.has(l.id),
  }));

  const toggleLayer = (layerId: string) => {
    setDetailVisibleLayers((prev) => {
      // Initialize from defaults if first toggle
      const next = new Set(
        prev.size === 0 ? rawLayers.filter((l) => l.isDefaultVisible).map((l) => l.id) : prev
      );
      if (next.has(layerId)) next.delete(layerId);
      else next.add(layerId);
      return next;
    });
  };

  // Submit form state
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newCategory, setNewCategory] = useState<ProposalCategory>("pista_noua");
  const [newLat, setNewLat] = useState(44.4505);
  const [newLng, setNewLng] = useState(26.1200);
  const [newAddress, setNewAddress] = useState("");
  const [locationPicked, setLocationPicked] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Drawing state
  const [drawTool, setDrawTool] = useState<DrawTool>("select");
  const [drawnPoints, setDrawnPoints] = useState<[number, number][]>([]);
  const [drawnLines, setDrawnLines] = useState<[number, number][][]>([]);
  const [drawingLine, setDrawingLine] = useState<[number, number][]>([]);

  const sortedProposals = [...proposals]
    .filter((p) => filterCategory === "all" || p.category === filterCategory)
    .sort((a, b) => {
      switch (sortBy) {
        case "votes":
          return b.votes - a.votes;
        case "recent":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "trending":
          return b.commentCount - a.commentCount;
        default:
          return 0;
      }
    });

  const handleVote = async (id: string, direction: "up" | "down") => {
    try {
      await apiPost(`/proposals/${id}/vote`, { direction });
      mutate();
    } catch {
      // Ignore errors (e.g., not logged in)
    }
  };

  const handleSubmitProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const categoryLabel = categoryOptions.find((c) => c.id === newCategory)?.label || newCategory;
      // Build geometry FeatureCollection from drawn features
      const features: any[] = [];
      for (const pt of drawnPoints) {
        features.push({ type: "Feature", geometry: { type: "Point", coordinates: [pt[1], pt[0]] }, properties: { kind: "point" } });
      }
      for (const line of drawnLines) {
        features.push({ type: "Feature", geometry: { type: "LineString", coordinates: line.map(([lat, lng]) => [lng, lat]) }, properties: { kind: "line" } });
      }
      const geometry = features.length > 0 ? { type: "FeatureCollection", features } : null;

      await apiPost("/proposals", {
        category: newCategory,
        categoryLabel,
        title: newTitle,
        description: newDescription,
        latitude: newLat,
        longitude: newLng,
        address: newAddress || `${newLat.toFixed(4)}, ${newLng.toFixed(4)}`,
        geometry,
      });
      setSubmitted(true);
      mutate();
      setTimeout(() => {
        setSubmitted(false);
        setNewTitle("");
        setNewDescription("");
        setDrawnPoints([]);
        setDrawnLines([]);
        setDrawingLine([]);
        setDrawTool("select");
        setTab("exploreaza");
      }, 2000);
    } catch {
      // Handle error
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageTransition>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold font-[family-name:var(--font-heading)] mb-6">
          Propuneri
        </h1>

        {/* Tab switcher */}
        <div className="flex rounded-lg bg-surface-light p-1 mb-6">
          {(
            [
              { id: "exploreaza" as Tab, label: "Explorează propuneri" },
              { id: "trimite" as Tab, label: "Trimite propunere" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="relative flex-1 rounded-md py-2 text-sm font-medium transition-colors"
            >
              {tab === t.id && (
                <motion.div
                  layoutId="proposal-tab"
                  className="absolute inset-0 rounded-md bg-primary/10 border border-primary/20"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative z-10">{t.label}</span>
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {tab === "exploreaza" ? (
            <motion.div
              key="explore"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {/* Filters */}
              <div className="flex flex-col sm:flex-row flex-wrap gap-3 mb-6">
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="rounded-lg bg-surface-light border border-border px-3 py-1.5 text-sm text-foreground"
                >
                  <option value="all">Toate categoriile</option>
                  {categoryOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>

                <div className="flex rounded-lg bg-surface-light p-0.5">
                  {(
                    [
                      { id: "votes" as SortBy, label: "Cele mai votate" },
                      { id: "recent" as SortBy, label: "Recente" },
                      { id: "trending" as SortBy, label: "Trending" },
                    ] as const
                  ).map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSortBy(s.id)}
                      className={cn(
                        "px-3 py-1 rounded-md text-xs font-medium transition-colors",
                        sortBy === s.id
                          ? "bg-primary/20 text-primary"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Proposal cards */}
              <StaggerContainer className="space-y-4">
                {sortedProposals.map((proposal) => (
                  <StaggerItem key={proposal.id}>
                    <ProposalCard
                      proposal={proposal}
                      onVote={handleVote}
                      showComments={expandedComments === proposal.id}
                      onToggleComments={() =>
                        setExpandedComments(
                          expandedComments === proposal.id ? null : proposal.id
                        )
                      }
                      onMutate={mutate}
                      onShowDetail={() => setSelectedProposal(proposal)}
                    />
                  </StaggerItem>
                ))}
              </StaggerContainer>

              {sortedProposals.length === 0 && (
                <EmptyState
                  title="Nicio propunere găsită"
                  description="Nu există propuneri care să corespundă filtrelor selectate."
                />
              )}
            </motion.div>
          ) : (
            <motion.div
              key="submit"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {submitted ? (
                <GlassCard className="text-center py-12" glowing>
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring" }}
                  >
                    <PartyPopper className="h-10 w-10 text-primary mx-auto" />
                  </motion.div>
                  <h2 className="text-xl font-bold font-[family-name:var(--font-heading)] mb-2">
                    Propunerea ta a fost trimisă!
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Va fi analizată de echipa de administrare.
                  </p>
                </GlassCard>
              ) : (
                <GlassCard>
                  <form onSubmit={handleSubmitProposal} className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
                        Categorie
                      </label>
                      <select
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value as ProposalCategory)}
                        className="w-full rounded-lg bg-surface border border-border px-3 py-2 text-sm text-foreground"
                      >
                        {categoryOptions.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
                        Titlu
                      </label>
                      <div className="relative">
                        <Input
                          placeholder="Titlul propunerii..."
                          value={newTitle}
                          onChange={(e) =>
                            setNewTitle(e.target.value.slice(0, 80))
                          }
                          maxLength={80}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                          {newTitle.length}/80
                        </span>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
                        Descriere
                      </label>
                      <Textarea
                        placeholder="Descrie propunerea ta în detaliu..."
                        value={newDescription}
                        onChange={(e) => setNewDescription(e.target.value)}
                        rows={5}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
                        Locație & Traseu
                      </label>
                      <p className="text-xs text-muted-foreground mb-2">
                        Click pe hartă pentru a plasa locația. Folosește instrumentele de mai jos pentru a desena trasee sau puncte de interes.
                      </p>

                      {/* Drawing tool buttons */}
                      <div className="flex items-center gap-1.5 mb-2">
                        {drawToolButtons.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => {
                              if (drawTool === "line" && t.id !== "line" && drawingLine.length >= 2) {
                                setDrawnLines((prev) => [...prev, drawingLine]);
                                setDrawingLine([]);
                              }
                              setDrawTool(t.id);
                            }}
                            className={cn(
                              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border",
                              drawTool === t.id
                                ? "bg-primary/20 text-primary border-primary/30"
                                : "bg-surface-light border-border text-muted-foreground hover:text-foreground"
                            )}
                          >
                            <t.icon className="h-3.5 w-3.5" />
                            {t.label}
                          </button>
                        ))}

                        {/* Line drawing controls */}
                        {drawTool === "line" && drawingLine.length > 0 && (
                          <>
                            <button
                              type="button"
                              onClick={() => setDrawingLine((prev) => prev.slice(0, -1))}
                              className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs bg-surface-light border border-border text-muted-foreground hover:text-foreground"
                            >
                              <Undo2 className="h-3.5 w-3.5" /> Undo
                            </button>
                            {drawingLine.length >= 2 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setDrawnLines((prev) => [...prev, drawingLine]);
                                  setDrawingLine([]);
                                }}
                                className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30"
                              >
                                <Check className="h-3.5 w-3.5" /> Finalizează
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setDrawingLine([])}
                              className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs bg-destructive/20 border border-destructive/30 text-destructive hover:bg-destructive/30"
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Anulează
                            </button>
                          </>
                        )}
                      </div>

                      {/* Drawing summary */}
                      {(drawnPoints.length > 0 || drawnLines.length > 0) && (
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                          {drawnLines.length > 0 && (
                            <span className="flex items-center gap-1">
                              <Ruler className="h-3 w-3 text-primary" /> {drawnLines.length} traseu{drawnLines.length !== 1 ? "e" : ""}
                            </span>
                          )}
                          {drawnPoints.length > 0 && (
                            <span className="flex items-center gap-1">
                              <Circle className="h-3 w-3 text-primary" /> {drawnPoints.length} punct{drawnPoints.length !== 1 ? "e" : ""}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => { setDrawnPoints([]); setDrawnLines([]); setDrawingLine([]); }}
                            className="text-destructive hover:text-destructive/80 flex items-center gap-0.5"
                          >
                            <Trash2 className="h-3 w-3" /> Șterge tot
                          </button>
                        </div>
                      )}

                      <div className="h-72 rounded-xl overflow-hidden border border-border mb-2">
                        <ProposalDrawMap
                          activeTool={drawTool}
                          points={drawnPoints}
                          lines={drawnLines}
                          drawingLine={drawingLine}
                          centerLat={newLat}
                          centerLng={newLng}
                          onAddPoint={(latlng) => setDrawnPoints((prev) => [...prev, latlng])}
                          onAddLinePoint={(latlng) => setDrawingLine((prev) => [...prev, latlng])}
                          onLocationChange={(lat, lng) => {
                            setNewLat(lat);
                            setNewLng(lng);
                            setLocationPicked(true);
                          }}
                          infraLayers={infraLayers}
                          infraElements={infraElements}
                        />
                      </div>
                      <Input
                        placeholder="Adresa orientativă (opțional dacă ai selectat pe hartă)..."
                        value={newAddress}
                        onChange={(e) => setNewAddress(e.target.value)}
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={!newTitle || !newDescription || submitting}
                      className="gap-2"
                      animated
                    >
                      <Send className="h-4 w-4" />
                      {submitting ? "Se trimite..." : "Trimite propunerea"}
                    </Button>
                  </form>
                </GlassCard>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Proposal Detail Modal */}
        <AnimatePresence>
          {selectedProposal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed top-14 left-0 right-0 bottom-0 z-[1050] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
              onClick={() => setSelectedProposal(null)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-surface border border-border rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-xl font-bold font-[family-name:var(--font-heading)]">
                      {selectedProposal.title}
                    </h2>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <StatusBadge label={selectedProposal.categoryLabel} colorClass="bg-surface-light text-muted-foreground border-border" />
                      <StatusBadge label={proposalStatusConfig[selectedProposal.status].label} colorClass={proposalStatusConfig[selectedProposal.status].color} />
                      <StatusBadge
                        label={selectedProposal.authorRole === "admin" ? "Admin" : "Cetățean"}
                        colorClass={selectedProposal.authorRole === "admin" ? "bg-purple-500/20 text-purple-400 border-purple-500/30" : "bg-blue-500/20 text-blue-400 border-blue-500/30"}
                      />
                    </div>
                  </div>
                  <button onClick={() => setSelectedProposal(null)} className="p-1 rounded-lg hover:bg-surface-light transition-colors">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <p className="text-sm text-muted-foreground mb-4">
                  {selectedProposal.description}
                </p>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="p-3 rounded-lg bg-surface-light/30">
                    <p className="text-xs text-muted-foreground mb-1">Autor</p>
                    <p className="text-sm font-medium flex items-center gap-1">
                      {selectedProposal.authorRole === "admin" ? <Shield className="h-3.5 w-3.5 text-purple-400" /> : <User className="h-3.5 w-3.5 text-blue-400" />}
                      {selectedProposal.authorName}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-surface-light/30">
                    <p className="text-xs text-muted-foreground mb-1">Voturi</p>
                    <p className="text-sm font-bold text-primary">{selectedProposal.votes}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-surface-light/30">
                    <p className="text-xs text-muted-foreground mb-1">Locație</p>
                    <p className="text-sm font-medium flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-primary" />
                      {selectedProposal.address}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-surface-light/30">
                    <p className="text-xs text-muted-foreground mb-1">Data</p>
                    <p className="text-sm font-medium flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {new Date(selectedProposal.createdAt).toLocaleDateString("ro-RO", { day: "numeric", month: "long", year: "numeric" })}
                    </p>
                  </div>
                </div>

                {/* Map with infrastructure layers + proposal geometry */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold flex items-center gap-1">
                      <MapIcon className="h-4 w-4" /> {selectedProposal.geometry ? "Traseu propus & Infrastructură" : "Hartă & Infrastructură"}
                    </h3>
                    <button
                      onClick={() => setShowLayerPanel(!showLayerPanel)}
                      className={cn(
                        "flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors border",
                        showLayerPanel
                          ? "bg-primary/20 text-primary border-primary/30"
                          : "bg-surface-light border-border text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Layers className="h-3.5 w-3.5" /> Straturi
                    </button>
                  </div>

                  {/* Layer toggles */}
                  {showLayerPanel && infraLayers.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {infraLayers.map((layer) => (
                        <button
                          key={layer.id}
                          onClick={() => toggleLayer(layer.id)}
                          className={cn(
                            "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors border",
                            layer.visible
                              ? "border-opacity-40 text-white"
                              : "bg-surface-light border-border text-muted-foreground opacity-50 hover:opacity-80"
                          )}
                          style={layer.visible ? { backgroundColor: `${layer.color}30`, borderColor: `${layer.color}60`, color: layer.color } : undefined}
                        >
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: layer.color }}
                          />
                          {layer.label}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="h-56 rounded-xl overflow-hidden border border-border">
                    <ProposalDrawMap
                      activeTool="select"
                      points={[]}
                      lines={[]}
                      drawingLine={[]}
                      centerLat={(selectedProposal as any).latitude ?? selectedProposal.location?.lat ?? 44.4505}
                      centerLng={(selectedProposal as any).longitude ?? selectedProposal.location?.lng ?? 26.12}
                      onAddPoint={() => {}}
                      onAddLinePoint={() => {}}
                      onLocationChange={() => {}}
                      existingGeometry={selectedProposal.geometry}
                      infraLayers={infraLayers}
                      infraElements={infraElements}
                    />
                  </div>
                </div>

                {/* Comments in detail view */}
                <div className="border-t border-border pt-4">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-1">
                    <MessageCircle className="h-4 w-4" /> {selectedProposal.commentCount} comentarii
                  </h3>
                  <div className="space-y-3">
                    {selectedProposal.comments.map((comment) => (
                      <DetailComment key={comment.id} comment={comment} proposalId={selectedProposal.id} onMutate={mutate} />
                    ))}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageTransition>
  );
}

// ============================
// Proposal Card Component
// ============================

function ProposalCard({
  proposal,
  onVote,
  showComments,
  onToggleComments,
  onMutate,
  onShowDetail,
}: {
  proposal: Proposal;
  onVote: (id: string, dir: "up" | "down") => void;
  showComments: boolean;
  onToggleComments: () => void;
  onMutate: () => void;
  onShowDetail: () => void;
}) {
  const statusCfg = proposalStatusConfig[proposal.status];
  const [commentText, setCommentText] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  const handleAddComment = async () => {
    if (!commentText.trim()) return;
    setSendingComment(true);
    try {
      await apiPost("/comments", { proposalId: proposal.id, content: commentText.trim() });
      setCommentText("");
      onMutate();
    } catch {
      // Ignore
    } finally {
      setSendingComment(false);
    }
  };

  const handleAddReply = async (parentId: string) => {
    if (!replyText.trim()) return;
    setSendingReply(true);
    try {
      await apiPost("/comments", { proposalId: proposal.id, parentId, content: replyText.trim() });
      setReplyText("");
      setReplyingTo(null);
      onMutate();
    } catch {
      // Ignore
    } finally {
      setSendingReply(false);
    }
  };

  return (
    <GlassCard hover>
      <div className="flex gap-3 sm:gap-4">
        {/* Vote column */}
        <div className="flex flex-col items-center gap-1 shrink-0">
          <motion.button
            whileTap={{ scale: 0.8 }}
            onClick={() => onVote(proposal.id, "up")}
            className={cn(
              "rounded-lg p-1.5 transition-colors",
              proposal.userVote === "up"
                ? "bg-primary/20 text-primary"
                : "text-muted-foreground hover:text-primary hover:bg-primary/10"
            )}
          >
            <ThumbsUp className="h-4 w-4" />
          </motion.button>
          <span
            className={cn(
              "text-sm font-bold",
              proposal.userVote === "up"
                ? "text-primary"
                : proposal.userVote === "down"
                ? "text-destructive"
                : "text-foreground"
            )}
          >
            {proposal.votes}
          </span>
          <motion.button
            whileTap={{ scale: 0.8 }}
            onClick={() => onVote(proposal.id, "down")}
            className={cn(
              "rounded-lg p-1.5 transition-colors",
              proposal.userVote === "down"
                ? "bg-destructive/20 text-destructive"
                : "text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            )}
          >
            <ThumbsDown className="h-4 w-4" />
          </motion.button>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <h3 className="font-semibold text-sm font-[family-name:var(--font-heading)] cursor-pointer hover:text-primary transition-colors" onClick={onShowDetail}>
                {proposal.title}
              </h3>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <StatusBadge label={proposal.categoryLabel} colorClass="bg-surface-light text-muted-foreground border-border" />
                <StatusBadge label={statusCfg.label} colorClass={statusCfg.color} />
                <StatusBadge
                  label={proposal.authorRole === "admin" ? "Admin" : "Cetățean"}
                  colorClass={proposal.authorRole === "admin" ? "bg-purple-500/20 text-purple-400 border-purple-500/30" : "bg-blue-500/20 text-blue-400 border-blue-500/30"}
                />
              </div>
            </div>
            <button onClick={onShowDetail} className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 shrink-0">
              <Eye className="h-3.5 w-3.5" /> Detalii
            </button>
          </div>

          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
            {proposal.description}
          </p>

          <div className="flex items-center gap-2 sm:gap-4 flex-wrap text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">
                {proposal.authorName
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </div>
              {proposal.authorName}
            </span>
            <span>
              {new Date(proposal.createdAt).toLocaleDateString("ro-RO", {
                day: "numeric",
                month: "short",
              })}
            </span>
            <button
              onClick={onToggleComments}
              className="flex items-center gap-1 hover:text-primary transition-colors"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              {proposal.commentCount} comentarii
            </button>
          </div>

          {/* Comments */}
          <AnimatePresence>
            {showComments && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-3 pt-3 border-t border-border space-y-2">
                  {proposal.comments.slice(0, 5).map((comment) => (
                    <div key={comment.id} className="flex gap-2">
                      <div className="h-6 w-6 shrink-0 rounded-full bg-surface-light flex items-center justify-center text-[9px] font-bold text-muted-foreground">
                        {comment.authorName
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium">{comment.authorName}</span>
                          {comment.authorRole === "admin" && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 font-medium">Admin</span>
                          )}
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(comment.createdAt).toLocaleDateString("ro-RO")}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">{comment.content}</p>
                        <button
                          onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                          className="text-[10px] text-primary hover:text-primary/80 mt-0.5 flex items-center gap-0.5"
                        >
                          <Reply className="h-3 w-3" /> Răspunde
                        </button>

                        {/* Reply input */}
                        {replyingTo === comment.id && (
                          <div className="flex gap-1.5 mt-1.5">
                            <Input
                              placeholder="Scrie un răspuns..."
                              className="text-xs h-7 flex-1"
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && handleAddReply(comment.id)}
                            />
                            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => handleAddReply(comment.id)} disabled={sendingReply || !replyText.trim()}>
                              <Send className="h-3 w-3" />
                            </Button>
                          </div>
                        )}

                        {/* Replies */}
                        {comment.replies.map((reply) => (
                          <div key={reply.id} className="ml-4 mt-1.5 flex gap-2">
                            <div className="h-5 w-5 shrink-0 rounded-full bg-surface-light flex items-center justify-center text-[8px] font-bold text-muted-foreground">
                              {reply.authorName
                                .split(" ")
                                .map((n) => n[0])
                                .join("")}
                            </div>
                            <div>
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] font-medium">{reply.authorName}</span>
                                {reply.authorRole === "admin" && (
                                  <span className="text-[8px] px-1 py-0.5 rounded bg-purple-500/20 text-purple-400 font-medium">Admin</span>
                                )}
                              </div>
                              <p className="text-[10px] text-muted-foreground">{reply.content}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div className="flex gap-2 mt-2">
                    <Input
                      placeholder="Adaugă un comentariu..."
                      className="text-xs h-8"
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddComment()}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2"
                      onClick={handleAddComment}
                      disabled={sendingComment || !commentText.trim()}
                    >
                      <Send className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </GlassCard>
  );
}

// ============================
// Detail Comment Component (used in modal)
// ============================

function DetailComment({ comment, proposalId, onMutate }: { comment: Comment; proposalId: string; onMutate: () => void }) {
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  const handleReply = async () => {
    if (!replyText.trim()) return;
    setSending(true);
    try {
      await apiPost("/comments", { proposalId, parentId: comment.id, content: replyText.trim() });
      setReplyText("");
      setShowReply(false);
      onMutate();
    } catch {
      // Ignore
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex gap-2">
      <div className="h-7 w-7 shrink-0 rounded-full bg-surface-light flex items-center justify-center text-[10px] font-bold text-muted-foreground">
        {comment.authorName.split(" ").map((n) => n[0]).join("")}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium">{comment.authorName}</span>
          {comment.authorRole === "admin" && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 font-medium">Admin</span>
          )}
          <span className="text-[10px] text-muted-foreground">
            {new Date(comment.createdAt).toLocaleDateString("ro-RO")}
          </span>
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">{comment.content}</p>
        <button
          onClick={() => setShowReply(!showReply)}
          className="text-[11px] text-primary hover:text-primary/80 mt-1 flex items-center gap-0.5"
        >
          <Reply className="h-3 w-3" /> Răspunde
        </button>

        {showReply && (
          <div className="flex gap-1.5 mt-1.5">
            <Input
              placeholder="Scrie un răspuns..."
              className="text-xs h-7 flex-1"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleReply()}
            />
            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={handleReply} disabled={sending || !replyText.trim()}>
              <Send className="h-3 w-3" />
            </Button>
          </div>
        )}

        {/* Nested replies */}
        {comment.replies.length > 0 && (
          <div className="ml-4 mt-2 space-y-2 border-l-2 border-border pl-3">
            {comment.replies.map((reply) => (
              <DetailComment key={reply.id} comment={reply} proposalId={proposalId} onMutate={onMutate} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
