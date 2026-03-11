"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import {
  Layers,
  X,
  Clock,
  AlertTriangle,
  Megaphone,
  ChevronRight,
  Filter,
  MapPin,
} from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { PageTransition } from "@/components/ui/page-transition";
import {
  defaultMapLayers,
  reportStatusConfig,
  severityConfig,
} from "@/lib/mock-data";
import { useReports } from "@/lib/api";
import type { MapLayer, Report } from "@/types";
import { cn } from "@/lib/utils";

const MapView = dynamic<{
  reports: Report[];
  layers: MapLayer[];
  onReportClick: (id: string) => void;
}>(() => import("@/app/cetatean/harta/map-view").then((mod) => mod.default), {
  ssr: false,
});

const timeRanges = [
  { value: "week", label: "Ultimele 7 zile" },
  { value: "month", label: "Ultima lună" },
  { value: "year", label: "Ultimul an" },
  { value: "all", label: "Tot" },
];

export default function HartaPage() {
  const [layers, setLayers] = useState<MapLayer[]>(defaultMapLayers);
  const [timeRange, setTimeRange] = useState("all");
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [showLayerPanel, setShowLayerPanel] = useState(true);
  const { data: reports } = useReports();

  const allReports = reports ?? [];
  const selectedReport = allReports.find((r) => r.id === selectedReportId);

  const toggleLayer = (id: string) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l))
    );
  };

  return (
    <PageTransition className="h-[calc(100vh-3.5rem-2rem)] sm:h-[calc(100vh-3.5rem-3rem)] -m-4 lg:-m-6 relative">
      {/* Map */}
      <MapView
        reports={allReports}
        layers={layers}
        onReportClick={setSelectedReportId}
      />

      {/* Layer control panel */}
      <AnimatePresence>
        {showLayerPanel && (
          <>
            {/* Mobile backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[999] bg-black/30 lg:hidden"
              onClick={() => setShowLayerPanel(false)}
            />
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.4}
              onDragEnd={(_, info) => {
                if (info.offset.x > 80) setShowLayerPanel(false);
              }}
              className="absolute top-4 right-4 z-[1000]"
          >
            <GlassCard className="w-56 sm:w-64 p-3">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold font-[family-name:var(--font-heading)]">
                    Straturi
                  </span>
                </div>
                <button
                  onClick={() => setShowLayerPanel(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-1">
                {layers.map((layer) => (
                  <button
                    key={layer.id}
                    onClick={() => toggleLayer(layer.id)}
                    className={cn(
                      "flex items-center gap-2 w-full rounded-lg px-2 py-1.5 text-xs transition-colors",
                      layer.visible
                        ? "bg-surface-light text-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-surface-light/50"
                    )}
                  >
                    <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: layer.color }} />
                    <span className="flex-1 text-left">{layer.label}</span>
                    <div
                      className={cn(
                        "h-2 w-2 rounded-full",
                        layer.visible ? "bg-accent" : "bg-muted-foreground/30"
                      )}
                    />
                  </button>
                ))}
              </div>
            </GlassCard>
          </motion.div>
          </>
        )}
      </AnimatePresence>

      {!showLayerPanel && (
        <button
          onClick={() => setShowLayerPanel(true)}
          className="absolute top-4 right-4 z-[1000] glass-strong rounded-lg p-2 hover:bg-surface-light transition-colors"
        >
          <Layers className="h-5 w-5 text-primary" />
        </button>
      )}

      {/* Time range slider */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] max-w-[calc(100vw-2rem)]">
        <GlassCard className="flex gap-1 p-1 overflow-x-auto">
          {timeRanges.map((t) => (
            <button
              key={t.value}
              onClick={() => setTimeRange(t.value)}
              className={cn(
                "relative px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                timeRange === t.value ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {timeRange === t.value && (
                <motion.div
                  layoutId="time-range-active"
                  className="absolute inset-0 rounded-md bg-primary/10 border border-primary/20"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative z-10 whitespace-nowrap">{t.label}</span>
            </button>
          ))}
        </GlassCard>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-[1000] hidden sm:block">
        <GlassCard className="p-2">
          <p className="text-[10px] font-medium text-muted-foreground mb-1">Legendă</p>
          <div className="space-y-0.5">
            {[
              { color: "bg-red-500", label: "Pericol ridicat" },
              { color: "bg-orange-500", label: "Pericol mediu" },
              { color: "bg-yellow-500", label: "Atenționare" },
              { color: "bg-green-500", label: "Rezolvat" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-1.5">
                <div className={cn("h-2 w-2 rounded-full", item.color)} />
                <span className="text-[10px] text-muted-foreground">{item.label}</span>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      {/* Report details drawer */}
      <AnimatePresence>
        {selectedReport && (
          <>
            {/* Mobile backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[999] bg-black/30 lg:hidden"
              onClick={() => setSelectedReportId(null)}
            />
            <motion.div
              initial={{ opacity: 0, x: -300 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -300 }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.4}
              onDragEnd={(_, info) => {
                if (info.offset.x < -80) setSelectedReportId(null);
              }}
              className="absolute top-4 left-4 z-[1000] w-72 sm:w-80"
          >
            <GlassCard className="p-4">
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-sm font-semibold font-[family-name:var(--font-heading)] pr-4">
                  {selectedReport.title}
                </h3>
                <button
                  onClick={() => setSelectedReportId(null)}
                  className="text-muted-foreground hover:text-foreground shrink-0 p-1 -m-1 rounded-lg hover:bg-surface-light"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex gap-2 mb-3">
                <StatusBadge
                  label={reportStatusConfig[selectedReport.status].label}
                  colorClass={reportStatusConfig[selectedReport.status].color}
                />
                <StatusBadge
                  label={severityConfig[selectedReport.severity].label}
                  colorClass={severityConfig[selectedReport.severity].color}
                />
              </div>
              <p className="text-xs text-muted-foreground mb-2">{selectedReport.description}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {selectedReport.address}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {new Date(selectedReport.createdAt).toLocaleDateString("ro-RO", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </GlassCard>
          </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Report here floating button */}
      <Button
        variant="accent"
        size="sm"
        animated
        className="absolute bottom-4 right-4 z-[1000] gap-2 shadow-lg"
        onClick={() => {}}
      >
        <Megaphone className="h-4 w-4" />
        Raportează aici
      </Button>
    </PageTransition>
  );
}
