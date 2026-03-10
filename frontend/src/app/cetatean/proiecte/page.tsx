"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart,
  MessageCircle,
  Share2,
  Bell,
  BellOff,
  ChevronRight,
  Send,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GlassCard } from "@/components/ui/glass-card";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  PageTransition,
  StaggerContainer,
  StaggerItem,
} from "@/components/ui/page-transition";
import { mockProjects, projectStageConfig } from "@/lib/mock-data";
import type { Project, ProjectStage } from "@/types";
import { cn } from "@/lib/utils";

const allStages: ProjectStage[] = [
  "consultare_publica",
  "aprobare",
  "in_lucru",
  "finalizat",
];

export default function ProiectePage() {
  const [projects, setProjects] = useState(mockProjects);
  const [expandedProject, setExpandedProject] = useState<string | null>(null);

  const toggleFollow = (id: string) => {
    setProjects((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              isFollowing: !p.isFollowing,
              followers: p.isFollowing ? p.followers - 1 : p.followers + 1,
            }
          : p
      )
    );
  };

  const toggleLike = (id: string) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, likes: p.likes + 1 } : p))
    );
  };

  return (
    <PageTransition>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold font-[family-name:var(--font-heading)] mb-6">
          Proiecte viitoare
        </h1>

        <StaggerContainer className="space-y-6">
          {projects.map((project) => (
            <StaggerItem key={project.id}>
              <ProjectCard
                project={project}
                expanded={expandedProject === project.id}
                onToggleExpand={() =>
                  setExpandedProject(
                    expandedProject === project.id ? null : project.id
                  )
                }
                onFollow={() => toggleFollow(project.id)}
                onLike={() => toggleLike(project.id)}
              />
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </PageTransition>
  );
}

function ProjectCard({
  project,
  expanded,
  onToggleExpand,
  onFollow,
  onLike,
}: {
  project: Project;
  expanded: boolean;
  onToggleExpand: () => void;
  onFollow: () => void;
  onLike: () => void;
}) {
  const stageCfg = projectStageConfig[project.stage];
  const stageIndex = allStages.indexOf(project.stage);

  return (
    <GlassCard hover>
      {/* Header image placeholder */}
      <div className="h-40 -mx-4 -mt-4 mb-4 rounded-t-xl bg-gradient-to-r from-primary/20 via-surface-light to-accent/10 flex items-center justify-center">
        <div className="text-center">
          <span className="text-4xl">🏗️</span>
          <p className="text-xs text-muted-foreground mt-1">Imagine proiect</p>
        </div>
      </div>

      {/* Title & status */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-lg font-semibold font-[family-name:var(--font-heading)]">
            {project.title}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <StatusBadge label={stageCfg.label} colorClass={stageCfg.color + " border-transparent"} />
            <span className="text-xs text-muted-foreground">📍 {project.address}</span>
          </div>
        </div>
        <Button
          variant={project.isFollowing ? "outline" : "default"}
          size="sm"
          onClick={onFollow}
          className="gap-1 shrink-0"
          animated
        >
          {project.isFollowing ? (
            <>
              <BellOff className="h-3.5 w-3.5" />
              Urmărit
            </>
          ) : (
            <>
              <Bell className="h-3.5 w-3.5" />
              Urmărește
            </>
          )}
        </Button>
      </div>

      <p className="text-sm text-muted-foreground mb-4 line-clamp-3">{project.description}</p>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex justify-between text-[10px] text-muted-foreground mb-1.5">
          {allStages.map((stage, i) => (
            <span
              key={stage}
              className={cn(
                i <= stageIndex ? "text-primary font-medium" : ""
              )}
            >
              {projectStageConfig[stage].label}
            </span>
          ))}
        </div>
        <div className="h-1.5 rounded-full bg-surface-light overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{
              width: `${((stageIndex + 1) / allStages.length) * 100}%`,
            }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
          />
        </div>
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground mb-3">
        {project.budget && (
          <span>💰 {project.budget}</span>
        )}
        <span>📅 {project.timeline}</span>
        <span>
          <Eye className="inline h-3 w-3 mr-0.5" />
          {project.followers} urmăritori
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 border-t border-border pt-3">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onLike}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
        >
          <Heart className="h-3.5 w-3.5" />
          {project.likes}
        </motion.button>
        <button
          onClick={onToggleExpand}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          {project.commentCount} comentarii
        </button>
        <button className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
          <Share2 className="h-3.5 w-3.5" />
          Distribuie
        </button>
      </div>

      {/* Comments section */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 pt-3 border-t border-border space-y-3">
              {project.comments.map((comment) => (
                <div key={comment.id} className="flex gap-2">
                  <div className="h-7 w-7 shrink-0 rounded-full bg-surface-light flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                    {comment.authorName
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium">{comment.authorName}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(comment.createdAt).toLocaleDateString("ro-RO")}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{comment.content}</p>
                    {comment.replies.map((reply) => (
                      <div key={reply.id} className="ml-4 mt-2 flex gap-2">
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
              <div className="flex gap-2">
                <Input placeholder="Adaugă un comentariu..." className="text-xs h-8" />
                <Button size="sm" variant="ghost" className="h-8 px-2">
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  );
}
