"use client";

import { useState, useMemo } from "react";
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
  ChevronDown,
} from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { PageTransition } from "@/components/ui/page-transition";
import type { InfrastructureType } from "@/types";

interface SelectedElement {
  id: string;
  name: string;
  type: string;
  properties: Record<string, string>;
}

const MapView = dynamic<{
  layers: InfraLayer[];
  activeTool: string;
  onSelectElement: (el: SelectedElement) => void;
}>(() => import("@/app/admin/infrastructura/infra-map").then((mod) => mod.default), {
  ssr: false,
});

interface InfraLayer {
  id: string;
  type: InfrastructureType;
  label: string;
  color: string;
  icon: string;
  visible: boolean;
  count: number;
}

const defaultLayers: InfraLayer[] = [
  { id: "l1", type: "pista_biciclete", label: "Piste biciclete", color: "#a3e635", icon: "🚲", visible: true, count: 24 },
  { id: "l2", type: "parcare_biciclete", label: "Parcări biciclete", color: "#00d4ff", icon: "🅿️", visible: true, count: 45 },
  { id: "l3", type: "semafor", label: "Semafoare", color: "#f59e0b", icon: "🚦", visible: true, count: 18 },
  { id: "l4", type: "zona_30", label: "Zone 30 km/h", color: "#a855f7", icon: "🔵", visible: false, count: 8 },
  { id: "l5", type: "zona_pietonala", label: "Zone pietonale", color: "#ec4899", icon: "🚶", visible: false, count: 12 },
];

type DrawingTool = "select" | "point" | "line" | "polygon";

const drawingTools: { tool: DrawingTool; icon: typeof MapPin; label: string }[] = [
  { tool: "select", icon: Pencil, label: "Selectare" },
  { tool: "point", icon: MapPin, label: "Punct" },
  { tool: "line", icon: Ruler, label: "Linie" },
  { tool: "polygon", icon: Square, label: "Poligon" },
];

export default function AdminInfrastructurePage() {
  const [layers, setLayers] = useState(defaultLayers);
  const [activeTool, setActiveTool] = useState<DrawingTool>("select");
  const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null);
  const [editingProps, setEditingProps] = useState(false);

  const toggleLayer = (id: string) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l))
    );
  };

  const totalElements = useMemo(() => layers.reduce((sum, l) => sum + l.count, 0), [layers]);

  const handleExport = () => {
    const data = JSON.stringify({ type: "FeatureCollection", features: [] }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "infrastructura_export.geojson";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <PageTransition>
      <div className="h-[calc(100vh-3.5rem-3rem)] flex flex-col lg:flex-row gap-4">
        {/* Left Panel - Layers & Tools */}
        <div className="w-full lg:w-72 shrink-0 flex flex-col gap-4">
          {/* Drawing Toolbar */}
          <GlassCard className="p-3">
            <p className="text-xs text-muted-foreground mb-2 font-medium">Instrumente</p>
            <div className="grid grid-cols-4 gap-1">
              {drawingTools.map((t) => (
                <button
                  key={t.tool}
                  onClick={() => setActiveTool(t.tool)}
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
          </GlassCard>

          {/* Layer Manager */}
          <GlassCard className="p-3 flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold">Straturi</span>
              </div>
              <span className="text-xs text-muted-foreground">{totalElements} elem.</span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-1 -mx-1 px-1">
              {layers.map((layer) => (
                <div
                  key={layer.id}
                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-surface-light transition-colors group"
                >
                  <button
                    onClick={() => toggleLayer(layer.id)}
                    className="shrink-0"
                    aria-label={layer.visible ? "Ascunde strat" : "Arată strat"}
                  >
                    {layer.visible ? (
                      <Eye className="h-4 w-4 text-foreground" />
                    ) : (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                  <div
                    className="h-3 w-3 rounded-full shrink-0"
                    style={{ backgroundColor: layer.color }}
                  />
                  <span
                    className={`text-xs flex-1 truncate ${
                      layer.visible ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {layer.label}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{layer.count}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-border pt-2 mt-2 flex gap-2">
              <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={handleExport}>
                <Download className="h-3 w-3 mr-1" /> Export GeoJSON
              </Button>
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
                      <button
                        onClick={() => setEditingProps(!editingProps)}
                        className="p-1 rounded hover:bg-surface-light"
                      >
                        {editingProps ? (
                          <Check className="h-3.5 w-3.5 text-accent" />
                        ) : (
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
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
                      <p className="font-medium">{selectedElement.name}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Tip</span>
                      <p className="font-medium">{selectedElement.type}</p>
                    </div>
                    {Object.entries(selectedElement.properties).map(([k, v]) => (
                      <div key={k}>
                        <span className="text-muted-foreground">{k}</span>
                        <p className="font-medium">{v}</p>
                      </div>
                    ))}
                  </div>
                </GlassCard>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Map Area */}
        <div className="flex-1 rounded-xl overflow-hidden border border-border relative min-h-[400px]">
          <MapView
            layers={layers}
            activeTool={activeTool}
            onSelectElement={(el) => {
              setSelectedElement(el);
              setEditingProps(false);
            }}
          />
          {/* Floating info */}
          <div className="absolute top-3 right-3 glass rounded-lg px-3 py-1.5 text-xs flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-accent animate-pulse" />
            Mod: <span className="font-medium text-warning">{drawingTools.find((t) => t.tool === activeTool)?.label}</span>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
