"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  X,
  MapPin,
  ThumbsUp,
  MessageSquare,
  Calendar,
  User,
  CheckCircle2,
  XCircle,
  Sparkles,
} from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageTransition, StaggerContainer, StaggerItem } from "@/components/ui/page-transition";
import { proposalStatusConfig } from "@/lib/mock-data";
import { useProposals, apiPatch } from "@/lib/api";
import type { Proposal, ProposalStatus } from "@/types";

const statusOptions: { value: ProposalStatus | "all"; label: string }[] = [
  { value: "all", label: "Toate" },
  { value: "in_analiza", label: "În analiză" },
  { value: "aprobat", label: "Aprobate" },
  { value: "respins", label: "Respinse" },
  { value: "in_implementare", label: "În implementare" },
];

type SortKey = "votes" | "date" | "comments";

export default function AdminProposalsPage() {
  const { data: apiProposals, mutate } = useProposals();
  const proposals = apiProposals || [];
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProposalStatus | "all">("all");
  const [sortBy, setSortBy] = useState<SortKey>("votes");
  const [sortDesc, setSortDesc] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);

  const filtered = useMemo(() => {
    let result = [...proposals];
    if (statusFilter !== "all") {
      result = result.filter((p) => p.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.authorName.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q)
      );
    }
    result.sort((a, b) => {
      let cmp = 0;
      if (sortBy === "votes") cmp = a.votes - b.votes;
      else if (sortBy === "comments") cmp = a.commentCount - b.commentCount;
      else cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return sortDesc ? -cmp : cmp;
    });
    return result;
  }, [proposals, statusFilter, search, sortBy, sortDesc]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((p) => p.id)));
    }
  };

  const bulkUpdateStatus = async (newStatus: ProposalStatus) => {
    await Promise.all(
      Array.from(selectedIds).map((id) => apiPatch(`/proposals/${id}`, { status: newStatus }))
    );
    setSelectedIds(new Set());
    mutate();
  };

  const updateStatus = async (id: string, newStatus: ProposalStatus) => {
    await apiPatch(`/proposals/${id}`, { status: newStatus });
    mutate();
    if (selectedProposal?.id === id) {
      setSelectedProposal((prev) => (prev ? { ...prev, status: newStatus } : null));
    }
  };

  const getStatusColor = (status: ProposalStatus) => {
    const conf = proposalStatusConfig[status];
    return conf?.color || "bg-slate-500/20 text-slate-400 border-slate-500/30";
  };

  return (
    <PageTransition>
      <div className="h-[calc(100vh-3.5rem-3rem)] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold font-[family-name:var(--font-heading)]">
              Propuneri cetățeni
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Revizuiește și gestionează propunerile trimise de cetățeni
            </p>
          </div>
          <span className="text-sm text-muted-foreground">
            {filtered.length} din {proposals.length} propuneri
          </span>
        </div>

        {/* Filters & Search */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Caută propuneri..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-1 glass rounded-lg p-1">
            {statusOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setStatusFilter(opt.value)}
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  statusFilter === opt.value
                    ? "bg-warning/20 text-warning"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              setSortDesc(!sortDesc);
            }}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowUpDown className="h-3 w-3" />
            {sortBy === "votes" ? "Voturi" : sortBy === "date" ? "Dată" : "Comentarii"}
            {sortDesc ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
          </button>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="bg-surface border border-border rounded-lg text-xs px-2 py-1.5 text-foreground"
          >
            <option value="votes">Sortare: Voturi</option>
            <option value="date">Sortare: Dată</option>
            <option value="comments">Sortare: Comentarii</option>
          </select>
        </div>

        {/* Bulk Actions */}
        <AnimatePresence>
          {selectedIds.size > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-3"
            >
              <div className="flex items-center gap-3 glass rounded-lg px-4 py-2">
                <span className="text-xs font-medium">
                  {selectedIds.size} selectate
                </span>
                <div className="h-4 w-px bg-border" />
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs text-accent"
                  onClick={() => bulkUpdateStatus("aprobat")}
                >
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Aprobă
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs text-destructive"
                  onClick={() => bulkUpdateStatus("respins")}
                >
                  <XCircle className="h-3 w-3 mr-1" /> Respinge
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs"
                  onClick={() => setSelectedIds(new Set())}
                >
                  Anulează
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Table */}
        <div className="flex-1 overflow-auto glass rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="p-3 w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === filtered.length && filtered.length > 0}
                    onChange={toggleAll}
                    className="accent-warning"
                  />
                </th>
                <th className="p-3">Propunere</th>
                <th className="p-3 hidden md:table-cell">Autor</th>
                <th className="p-3 hidden lg:table-cell">Locație</th>
                <th className="p-3 text-center">Voturi</th>
                <th className="p-3 text-center hidden sm:table-cell">Comentarii</th>
                <th className="p-3">Status</th>
                <th className="p-3 w-24">Acțiuni</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <motion.tr
                  key={p.id}
                  layout
                  className={`border-b border-border/50 hover:bg-surface-light/50 transition-colors cursor-pointer ${
                    selectedIds.has(p.id) ? "bg-warning/5" : ""
                  }`}
                  onClick={() => setSelectedProposal(p)}
                >
                  <td className="p-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(p.id)}
                      onChange={() => toggleSelect(p.id)}
                      className="accent-warning"
                    />
                  </td>
                  <td className="p-3">
                    <div className="max-w-[250px]">
                      <p className="font-medium text-sm line-clamp-1">{p.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">{p.categoryLabel}</p>
                    </div>
                  </td>
                  <td className="p-3 hidden md:table-cell">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">
                        {p.authorName.charAt(0)}
                      </div>
                      <span className="text-xs">{p.authorName}</span>
                    </div>
                  </td>
                  <td className="p-3 hidden lg:table-cell">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {p.address}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <span className="text-xs font-medium flex items-center justify-center gap-1">
                      <ThumbsUp className="h-3 w-3 text-accent" /> {p.votes}
                    </span>
                  </td>
                  <td className="p-3 text-center hidden sm:table-cell">
                    <span className="text-xs text-muted-foreground">{p.commentCount}</span>
                  </td>
                  <td className="p-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${getStatusColor(p.status)}`}
                    >
                      {proposalStatusConfig[p.status]?.label || p.status}
                    </span>
                  </td>
                  <td className="p-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-1">
                      <button
                        onClick={() => updateStatus(p.id, "aprobat")}
                        className="p-1 rounded hover:bg-accent/20 text-accent transition-colors"
                        title="Aprobă"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => updateStatus(p.id, "respins")}
                        className="p-1 rounded hover:bg-destructive/20 text-destructive transition-colors"
                        title="Respinge"
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Search className="h-8 w-8 mb-2 opacity-40" />
              <p className="text-sm">Nicio propunere găsită</p>
            </div>
          )}
        </div>

        {/* Detail Drawer */}
        <AnimatePresence>
          {selectedProposal && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 z-40"
                onClick={() => setSelectedProposal(null)}
              />
              <motion.div
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="fixed right-0 top-0 h-full w-full max-w-md glass-strong border-l border-border z-50 flex flex-col"
              >
                <div className="flex items-center justify-between p-4 border-b border-border">
                  <h2 className="text-lg font-bold font-[family-name:var(--font-heading)] line-clamp-1">
                    {selectedProposal.title}
                  </h2>
                  <button
                    onClick={() => setSelectedProposal(null)}
                    className="p-1.5 rounded-lg hover:bg-surface-light"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-5">
                  {/* Status */}
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(selectedProposal.status)}`}
                    >
                      {proposalStatusConfig[selectedProposal.status]?.label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {selectedProposal.categoryLabel}
                    </span>
                  </div>

                  {/* Author */}
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">
                      {selectedProposal.authorName.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{selectedProposal.authorName}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(selectedProposal.createdAt).toLocaleDateString("ro-RO", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Descriere</p>
                    <p className="text-sm">{selectedProposal.description}</p>
                  </div>

                  {/* Meta */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center p-3 rounded-lg bg-surface-light">
                      <ThumbsUp className="h-4 w-4 mx-auto mb-1 text-accent" />
                      <p className="text-lg font-bold">{selectedProposal.votes}</p>
                      <p className="text-[10px] text-muted-foreground">Voturi</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-surface-light">
                      <MessageSquare className="h-4 w-4 mx-auto mb-1 text-primary" />
                      <p className="text-lg font-bold">{selectedProposal.commentCount}</p>
                      <p className="text-[10px] text-muted-foreground">Comentarii</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-surface-light">
                      <MapPin className="h-4 w-4 mx-auto mb-1 text-warning" />
                      <p className="text-xs font-medium mt-1 line-clamp-2">{selectedProposal.address}</p>
                    </div>
                  </div>

                  {/* AI Summary placeholder */}
                  <GlassCard className="p-3 border-primary/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <span className="text-xs font-semibold text-primary">Sumar AI</span>
                    </div>
                    <p className="text-xs text-muted-foreground italic">
                      Funcționalitate disponibilă în curând — sumarizare automată a propunerii
                      și comentariilor folosind AI.
                    </p>
                  </GlassCard>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      className="flex-1"
                      variant="accent"
                      size="sm"
                      onClick={() => updateStatus(selectedProposal.id, "aprobat")}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" /> Aprobă
                    </Button>
                    <Button
                      className="flex-1"
                      variant="destructive"
                      size="sm"
                      onClick={() => updateStatus(selectedProposal.id, "respins")}
                    >
                      <XCircle className="h-4 w-4 mr-1" /> Respinge
                    </Button>
                  </div>

                  {/* Comments */}
                  {selectedProposal.comments.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">
                        Comentarii ({selectedProposal.comments.length})
                      </p>
                      <div className="space-y-3">
                        {selectedProposal.comments.map((c) => (
                          <div key={c.id} className="flex gap-2">
                            <div className="h-6 w-6 rounded-full bg-surface-light flex items-center justify-center text-[10px] font-bold shrink-0">
                              {c.authorName.charAt(0)}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium">{c.authorName}</span>
                                <span className="text-[10px] text-muted-foreground">
                                  {new Date(c.createdAt).toLocaleDateString("ro-RO")}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">{c.content}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </PageTransition>
  );
}
