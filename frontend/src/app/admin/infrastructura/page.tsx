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
import { Input } from "@/components/ui/input";
import { PageTransition } from "@/components/ui/page-transition";
import { useInfrastructureLayers, useInfrastructureElements, apiPost, apiPatch, apiDelete } from "@/lib/api";
import type { InfrastructureType } from "@/types";

interface SelectedElement {
  id: string;
  name: string;
  type: string;
  properties: Record<string, string>;
}

const MapView = dynamic<{
  layers: InfraLayer[];
  elements: any[];
  activeTool: string;
  onSelectElement: (el: SelectedElement) => void;
  onAddPoint?: (latlng: { lat: number; lng: number }) => void;
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

type DrawingTool = "select" | "point" | "line" | "polygon";

const drawingTools: { tool: DrawingTool; icon: typeof MapPin; label: string }[] = [
  { tool: "select", icon: Pencil, label: "Selectare" },
  { tool: "point", icon: MapPin, label: "Punct" },
  { tool: "line", icon: Ruler, label: "Linie" },
  { tool: "polygon", icon: Square, label: "Poligon" },
];

export default function AdminInfrastructurePage() {
  const { data: apiLayers } = useInfrastructureLayers();
  const { data: apiElements, mutate: mutateElements } = useInfrastructureElements();
  const [layers, setLayers] = useState<InfraLayer[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [activeTool, setActiveTool] = useState<DrawingTool>("select");
  const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null);
  const [editingProps, setEditingProps] = useState(false);
  const [editedProps, setEditedProps] = useState<Record<string, string>>({});
  const [editedName, setEditedName] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [pendingPoint, setPendingPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [newElementName, setNewElementName] = useState("");
  const [newElementLayerId, setNewElementLayerId] = useState("");

  if (apiLayers && !initialized) {
    setLayers(
      apiLayers.map((l) => ({
        id: l.id,
        type: l.type as InfrastructureType,
        label: l.label,
        color: l.color,
        icon: l.icon,
        visible: l.isDefaultVisible,
        count: l.count,
      }))
    );
    setInitialized(true);
  }

  const elements = apiElements || [];

  const toggleLayer = (id: string) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l))
    );
  };

  const totalElements = useMemo(() => layers.reduce((sum, l) => sum + l.count, 0), [layers]);

  const handleExport = () => {
    const features = elements.map((el: any) => ({
      type: "Feature",
      geometry: el.geometry,
      properties: { id: el.id, name: el.name, type: el.type, typeLabel: el.typeLabel, ...el.properties },
    }));
    const data = JSON.stringify({ type: "FeatureCollection", features }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "infrastructura_export.geojson";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAddPoint = (latlng: { lat: number; lng: number }) => {
    setPendingPoint(latlng);
    setShowAddForm(true);
    setNewElementName("");
    setNewElementLayerId(layers[0]?.id || "");
  };

  const handleCreateElement = async () => {
    if (!pendingPoint || !newElementName || !newElementLayerId) return;
    const layer = layers.find((l) => l.id === newElementLayerId);
    await apiPost("/infrastructure", {
      layerId: newElementLayerId,
      type: layer?.type || "parcare_biciclete",
      typeLabel: layer?.label || "",
      name: newElementName,
      geometry: { type: "Point", coordinates: [pendingPoint.lng, pendingPoint.lat] },
      properties: {},
    });
    mutateElements();
    setShowAddForm(false);
    setPendingPoint(null);
  };

  const handleSaveElement = async () => {
    if (!selectedElement) return;
    await apiPatch(`/infrastructure/${selectedElement.id}`, {
      name: editedName,
      properties: editedProps,
    });
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
                      {editingProps ? (
                        <button
                          onClick={handleSaveElement}
                          className="p-1 rounded hover:bg-surface-light"
                        >
                          <Check className="h-3.5 w-3.5 text-accent" />
                        </button>
                      ) : (
                        <button
                          onClick={() => setEditingProps(true)}
                          className="p-1 rounded hover:bg-surface-light"
                        >
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                      )}
                      <button
                        onClick={handleDeleteElement}
                        className="p-1 rounded hover:bg-destructive/20"
                        title="Șterge element"
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
                            onChange={(e) => setEditedProps((prev) => ({ ...prev, [k]: e.target.value }))}
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

          {/* Add Element Form */}
          <AnimatePresence>
            {showAddForm && pendingPoint && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
              >
                <GlassCard className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold">Element nou</span>
                    <button onClick={() => { setShowAddForm(false); setPendingPoint(null); }} className="p-1 rounded hover:bg-surface-light">
                      <X className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </div>
                  <div className="space-y-2 text-xs">
                    <p className="text-muted-foreground">Lat: {pendingPoint.lat.toFixed(5)}, Lng: {pendingPoint.lng.toFixed(5)}</p>
                    <Input placeholder="Numele elementului" value={newElementName} onChange={(e) => setNewElementName(e.target.value)} className="text-xs h-7" />
                    <select
                      value={newElementLayerId}
                      onChange={(e) => setNewElementLayerId(e.target.value)}
                      className="w-full bg-surface border border-border rounded-lg text-xs px-2 py-1.5 text-foreground"
                    >
                      {layers.map((l) => (
                        <option key={l.id} value={l.id}>{l.label}</option>
                      ))}
                    </select>
                    <Button size="sm" variant="accent" className="w-full text-xs" onClick={handleCreateElement} disabled={!newElementName}>
                      <Plus className="h-3 w-3 mr-1" /> Adaugă
                    </Button>
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
            elements={elements}
            activeTool={activeTool}
            onSelectElement={(el) => {
              setSelectedElement(el);
              setEditingProps(false);
              setEditedName(el.name);
              setEditedProps({ ...el.properties });
            }}
            onAddPoint={handleAddPoint}
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
