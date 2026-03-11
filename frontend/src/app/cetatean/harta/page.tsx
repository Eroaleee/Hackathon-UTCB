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
  Navigation,
  Bike,
  Shield,
  Gauge,
  Loader2,
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
import {
  useReports,
  useProposals,
  useProjects,
  useTransitStops,
  useTransitShapes,
  useInfrastructureElements,
  planBikeRoute,
} from "@/lib/api";
import type { MapLayer, Report, BikeRouteResult } from "@/types";
import { cn } from "@/lib/utils";

const MapView = dynamic<{
  reports: Report[];
  proposals?: any[];
  projects?: any[];
  transitStops?: any[];
  transitShapes?: any;
  infrastructureElements?: any[];
  layers: MapLayer[];
  onReportClick: (id: string) => void;
  bikeRoute?: BikeRouteResult | null;
  routePickerMode?: "start" | "end" | null;
  onMapClick?: (lat: number, lng: number) => void;
  routeStart?: { lat: number; lng: number } | null;
  routeEnd?: { lat: number; lng: number } | null;
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
  const { data: proposals } = useProposals();
  const { data: projects } = useProjects();
  const { data: transitStops } = useTransitStops();
  const { data: transitShapes } = useTransitShapes();
  const { data: infraElements } = useInfrastructureElements();

  // Route planner state
  const [showRoutePlanner, setShowRoutePlanner] = useState(false);
  const [routePickerMode, setRoutePickerMode] = useState<"start" | "end" | null>(null);
  const [routeStart, setRouteStart] = useState<{ lat: number; lng: number } | null>(null);
  const [routeEnd, setRouteEnd] = useState<{ lat: number; lng: number } | null>(null);
  const [bikeRoute, setBikeRoute] = useState<BikeRouteResult | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);

  const allReports = reports ?? [];
  const selectedReport = allReports.find((r) => r.id === selectedReportId);

  const toggleLayer = (id: string) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l))
    );
  };

  const handleMapClick = (lat: number, lng: number) => {
    if (routePickerMode === "start") {
      setRouteStart({ lat, lng });
      setRoutePickerMode("end");
      setBikeRoute(null);
    } else if (routePickerMode === "end") {
      setRouteEnd({ lat, lng });
      setRoutePickerMode(null);
    }
  };

  const calculateRoute = async () => {
    if (!routeStart || !routeEnd) return;
    setRouteLoading(true);
    setRouteError(null);
    try {
      const result = await planBikeRoute(routeStart.lat, routeStart.lng, routeEnd.lat, routeEnd.lng);
      setBikeRoute(result);
      if (!result.found) setRouteError("Nu s-a găsit o rută. Încearcă puncte mai aproape de rețeaua de drumuri.");
    } catch (err: any) {
      console.error("Route calculation error:", err);
      setRouteError(`Eroare la calculul rutei: ${err?.message || "Necunoscută"}`);
    } finally {
      setRouteLoading(false);
    }
  };

  const resetRoute = () => {
    setRouteStart(null);
    setRouteEnd(null);
    setBikeRoute(null);
    setRoutePickerMode(null);
    setRouteError(null);
  };

  return (
    <PageTransition className="h-[calc(100vh-3.5rem-2rem)] sm:h-[calc(100vh-3.5rem-3rem)] -m-4 lg:-m-6 relative">
      {/* Map */}
      <MapView
        reports={allReports}
        proposals={proposals}
        projects={projects}
        transitStops={transitStops}
        transitShapes={transitShapes}
        infrastructureElements={infraElements}
        layers={layers}
        onReportClick={setSelectedReportId}
        bikeRoute={bikeRoute}
        routePickerMode={routePickerMode}
        onMapClick={handleMapClick}
        routeStart={routeStart}
        routeEnd={routeEnd}
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

      {/* Route planner panel */}
      <AnimatePresence>
        {showRoutePlanner && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[999] bg-black/30 lg:hidden"
              onClick={() => setShowRoutePlanner(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              className="absolute bottom-16 left-4 z-[1001] w-72 sm:w-80"
            >
              <GlassCard className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Bike className="h-4 w-4 text-accent" />
                    <span className="text-sm font-semibold font-[family-name:var(--font-heading)]">
                      Planificator Rută
                    </span>
                  </div>
                  <button onClick={() => { setShowRoutePlanner(false); resetRoute(); }} className="text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Start / End selection */}
                <div className="space-y-2 mb-3">
                  <button
                    onClick={() => setRoutePickerMode("start")}
                    className={cn(
                      "flex items-center gap-2 w-full rounded-lg px-3 py-2 text-xs transition-colors border",
                      routePickerMode === "start" ? "border-green-500 bg-green-500/10 text-green-400" :
                      routeStart ? "border-green-500/30 text-green-400" : "border-border text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <div className="h-3 w-3 rounded-full bg-green-500 shrink-0" />
                    {routeStart
                      ? `${routeStart.lat.toFixed(4)}, ${routeStart.lng.toFixed(4)}`
                      : routePickerMode === "start" ? "Apasă pe hartă..." : "Alege punct de plecare"}
                  </button>
                  <button
                    onClick={() => setRoutePickerMode("end")}
                    className={cn(
                      "flex items-center gap-2 w-full rounded-lg px-3 py-2 text-xs transition-colors border",
                      routePickerMode === "end" ? "border-red-500 bg-red-500/10 text-red-400" :
                      routeEnd ? "border-red-500/30 text-red-400" : "border-border text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <div className="h-3 w-3 rounded-full bg-red-500 shrink-0" />
                    {routeEnd
                      ? `${routeEnd.lat.toFixed(4)}, ${routeEnd.lng.toFixed(4)}`
                      : routePickerMode === "end" ? "Apasă pe hartă..." : "Alege destinația"}
                  </button>
                </div>

                <div className="flex gap-2 mb-3">
                  <Button
                    variant="accent"
                    size="sm"
                    className="flex-1 text-xs"
                    disabled={!routeStart || !routeEnd || routeLoading}
                    onClick={calculateRoute}
                  >
                    {routeLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Navigation className="h-3 w-3 mr-1" />}
                    Calculează ruta
                  </Button>
                  <Button variant="ghost" size="sm" className="text-xs" onClick={resetRoute}>
                    Resetează
                  </Button>
                </div>

                {routeError && (
                  <p className="text-xs text-red-400 mb-2">{routeError}</p>
                )}

                {/* Route results */}
                {bikeRoute?.found && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg bg-surface-light p-2 text-center">
                        <Gauge className="h-3 w-3 mx-auto mb-1 text-primary" />
                        <p className="text-xs font-semibold">{(bikeRoute.totalDistanceM / 1000).toFixed(1)} km</p>
                        <p className="text-[10px] text-muted-foreground">Distanță</p>
                      </div>
                      <div className="rounded-lg bg-surface-light p-2 text-center">
                        <Clock className="h-3 w-3 mx-auto mb-1 text-primary" />
                        <p className="text-xs font-semibold">{bikeRoute.totalTimeMin} min</p>
                        <p className="text-[10px] text-muted-foreground">Durată</p>
                      </div>
                      <div className="rounded-lg bg-surface-light p-2 text-center">
                        <Shield className="h-3 w-3 mx-auto mb-1 text-primary" />
                        <p className="text-xs font-semibold">{bikeRoute.safetyAvg}%</p>
                        <p className="text-[10px] text-muted-foreground">Siguranță</p>
                      </div>
                      <div className="rounded-lg bg-surface-light p-2 text-center">
                        <Bike className="h-3 w-3 mx-auto mb-1 text-primary" />
                        <p className="text-xs font-semibold">{bikeRoute.bikeLanePercent}%</p>
                        <p className="text-[10px] text-muted-foreground">Pistă ciclabilă</p>
                      </div>
                    </div>

                    {/* Route legend */}
                    <div className="space-y-0.5">
                      <p className="text-[10px] font-medium text-muted-foreground">Legendă traseu</p>
                      {[
                        { color: "bg-green-500", label: "Pistă ciclabilă" },
                        { color: "bg-green-300", label: "Zonă pietonală" },
                        { color: "bg-yellow-400", label: "Bandă partajată" },
                        { color: "bg-red-500", label: "Drum auto (periculos)" },
                        { color: "bg-yellow-300", label: "Punct sigur sugerit" },
                      ].map((item) => (
                        <div key={item.label} className="flex items-center gap-1.5">
                          <div className={cn("h-2 w-2 rounded-full", item.color)} />
                          <span className="text-[10px] text-muted-foreground">{item.label}</span>
                        </div>
                      ))}
                    </div>

                    {/* Safe spots list */}
                    {bikeRoute.safeSpots.length > 0 && (
                      <div>
                        <p className="text-[10px] font-medium text-yellow-400 mb-1">
                          ⚠ Zone fără pistă ciclabilă – puncte sigure sugerate:
                        </p>
                        {bikeRoute.safeSpots.slice(0, 4).map((spot, idx) => (
                          <p key={idx} className="text-[10px] text-muted-foreground pl-2">
                            • {spot.name}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </GlassCard>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Route planner floating button */}
      <Button
        variant={showRoutePlanner ? "default" : "accent"}
        size="sm"
        animated
        className="absolute bottom-14 left-4 z-[1000] gap-2 shadow-lg"
        onClick={() => {
          setShowRoutePlanner(!showRoutePlanner);
          if (showRoutePlanner) resetRoute();
        }}
      >
        <Bike className="h-4 w-4" />
        {showRoutePlanner ? "Închide" : "Planifică ruta"}
      </Button>

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
