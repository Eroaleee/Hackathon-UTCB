"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ThumbsUp,
  ThumbsDown,
  MessageCircle,
  Filter,
  Plus,
  ChevronDown,
  Send,
  MapPin,
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
  mockProposals,
  proposalCategoryLabels,
  proposalStatusConfig,
} from "@/lib/mock-data";
import type { Proposal, ProposalCategory } from "@/types";
import { cn } from "@/lib/utils";

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
  const [sortBy, setSortBy] = useState<SortBy>("votes");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [proposals, setProposals] = useState(mockProposals);
  const [expandedComments, setExpandedComments] = useState<string | null>(null);

  // Submit form state
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newCategory, setNewCategory] = useState<ProposalCategory>("pista_noua");
  const [submitted, setSubmitted] = useState(false);

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

  const handleVote = (id: string, direction: "up" | "down") => {
    setProposals((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const wasUp = p.userVote === "up";
        const wasDown = p.userVote === "down";

        if (direction === "up") {
          return {
            ...p,
            votes: wasUp ? p.votes - 1 : wasDown ? p.votes + 2 : p.votes + 1,
            userVote: wasUp ? null : "up",
          };
        } else {
          return {
            ...p,
            votes: wasDown ? p.votes + 1 : wasUp ? p.votes - 2 : p.votes - 1,
            userVote: wasDown ? null : "down",
          };
        }
      })
    );
  };

  const handleSubmitProposal = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setNewTitle("");
      setNewDescription("");
      setTab("exploreaza");
    }, 2000);
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
              <div className="flex flex-wrap gap-3 mb-6">
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
                    <div className="text-4xl mb-4">🎉</div>
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
                        Locație
                      </label>
                      <div className="h-40 rounded-xl bg-surface-light/50 border border-border flex items-center justify-center">
                        <div className="text-center text-muted-foreground text-sm">
                          <MapPin className="h-6 w-6 mx-auto mb-1 text-primary" />
                          Apasă pentru a selecta locația pe hartă
                        </div>
                      </div>
                    </div>
                    <Button
                      type="submit"
                      disabled={!newTitle || !newDescription}
                      className="gap-2"
                      animated
                    >
                      <Send className="h-4 w-4" />
                      Trimite propunerea
                    </Button>
                  </form>
                </GlassCard>
              )}
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
}: {
  proposal: Proposal;
  onVote: (id: string, dir: "up" | "down") => void;
  showComments: boolean;
  onToggleComments: () => void;
}) {
  const statusCfg = proposalStatusConfig[proposal.status];

  return (
    <GlassCard hover>
      <div className="flex gap-4">
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
              <h3 className="font-semibold text-sm font-[family-name:var(--font-heading)]">
                {proposal.title}
              </h3>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <StatusBadge label={proposal.categoryLabel} colorClass="bg-surface-light text-muted-foreground border-border" />
                <StatusBadge label={statusCfg.label} colorClass={statusCfg.color} />
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
            {proposal.description}
          </p>

          <div className="flex items-center gap-4 text-xs text-muted-foreground">
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
                  {proposal.comments.slice(0, 3).map((comment) => (
                    <div key={comment.id} className="flex gap-2">
                      <div className="h-6 w-6 shrink-0 rounded-full bg-surface-light flex items-center justify-center text-[9px] font-bold text-muted-foreground">
                        {comment.authorName
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium">{comment.authorName}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(comment.createdAt).toLocaleDateString("ro-RO")}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">{comment.content}</p>

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
                              <span className="text-[10px] font-medium">{reply.authorName}</span>
                              <p className="text-[10px] text-muted-foreground">{reply.content}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div className="flex gap-2 mt-2">
                    <Input placeholder="Adaugă un comentariu..." className="text-xs h-8" />
                    <Button size="sm" variant="ghost" className="h-8 px-2">
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
