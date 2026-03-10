"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Car,
  Construction,
  Ban,
  PersonStanding,
  AlertTriangle,
  ParkingCircle,
  Lightbulb,
  MapPin,
  ChevronRight,
  ChevronLeft,
  Upload,
  CheckCircle,
  Camera,
  LocateFixed,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/input";
import { GlassCard } from "@/components/ui/glass-card";
import { ProgressStepper } from "@/components/ui/progress-stepper";
import { StatusBadge } from "@/components/ui/status-badge";
import { PageTransition } from "@/components/ui/page-transition";
import { XPToast } from "@/components/ui/xp-toast";
import { severityConfig, reportCategoryLabels, reportCategoryIcons } from "@/lib/mock-data";
import type { ReportCategory, ReportSeverity } from "@/types";
import { cn } from "@/lib/utils";

const steps = ["Categorie", "Locație", "Detalii", "Confirmare"];

const categories: { id: ReportCategory; label: string; icon: string }[] = [
  { id: "masini_parcate", label: "Mașini parcate pe piste", icon: "🚗" },
  { id: "gropi", label: "Gropi / deteriorări", icon: "🕳️" },
  { id: "constructii", label: "Construcții blocante", icon: "🚧" },
  { id: "drum_blocat", label: "Drum blocat", icon: "🚫" },
  { id: "interferenta_pietoni", label: "Interferență cu pietonii", icon: "🚶" },
  { id: "obstacole", label: "Obstacole pe drumuri", icon: "⚠️" },
  { id: "parcari_biciclete", label: "Parcări de biciclete proaste", icon: "🅿️" },
  { id: "iluminat", label: "Iluminat insuficient", icon: "🔦" },
  { id: "altele", label: "Altele", icon: "📍" },
];

const severities: { id: ReportSeverity; label: string; color: string }[] = [
  { id: "scazut", label: "Scăzut", color: "bg-blue-500 hover:bg-blue-600" },
  { id: "mediu", label: "Mediu", color: "bg-yellow-500 hover:bg-yellow-600" },
  { id: "ridicat", label: "Ridicat", color: "bg-orange-500 hover:bg-orange-600" },
  { id: "critic", label: "Critic", color: "bg-red-500 hover:bg-red-600" },
];

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -300 : 300,
    opacity: 0,
  }),
};

export default function FeedbackPage() {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [showXP, setShowXP] = useState(false);

  // Form state
  const [category, setCategory] = useState<ReportCategory | null>(null);
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<ReportSeverity>("mediu");
  const [seenCount, setSeenCount] = useState(1);
  const [customCategory, setCustomCategory] = useState("");

  const goNext = () => {
    setDirection(1);
    setStep((s) => Math.min(s + 1, steps.length - 1));
  };
  const goPrev = () => {
    setDirection(-1);
    setStep((s) => Math.max(s - 1, 0));
  };

  const handleSubmit = () => {
    setSubmitted(true);
    setTimeout(() => setShowXP(true), 500);
  };

  const handleReset = () => {
    setStep(0);
    setCategory(null);
    setAddress("");
    setDescription("");
    setSeverity("mediu");
    setSeenCount(1);
    setCustomCategory("");
    setSubmitted(false);
    setShowXP(false);
  };

  const canProceed = () => {
    switch (step) {
      case 0:
        return category !== null;
      case 1:
        return address.length > 0;
      case 2:
        return description.length > 0;
      default:
        return true;
    }
  };

  if (submitted) {
    return (
      <PageTransition>
        <div className="max-w-2xl mx-auto">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
          >
            <GlassCard className="text-center py-12" glowing>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 300 }}
              >
                <CheckCircle className="h-16 w-16 text-accent mx-auto mb-4" />
              </motion.div>
              <h2 className="text-2xl font-bold font-[family-name:var(--font-heading)] mb-2">
                Raportul tău a fost trimis cu succes!
              </h2>
              <p className="text-muted-foreground mb-6">
                Mulțumim pentru contribuția ta la îmbunătățirea infrastructurii ciclabile.
              </p>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="inline-flex items-center gap-2 rounded-full bg-accent/20 px-4 py-2 text-accent font-bold mb-6"
              >
                ⭐ +15 puncte pentru raport!
              </motion.div>
              <div>
                <Button onClick={handleReset} variant="outline">
                  Trimite alt raport
                </Button>
              </div>
            </GlassCard>
          </motion.div>
          <XPToast
            points={15}
            message="Puncte pentru raportul trimis!"
            visible={showXP}
            onClose={() => setShowXP(false)}
          />
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold font-[family-name:var(--font-heading)] mb-6">
          Raportează o problemă
        </h1>

        <ProgressStepper steps={steps} currentStep={step} className="mb-8" />

        <div className="relative overflow-hidden">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
              {/* Step 1: Category */}
              {step === 0 && (
                <GlassCard>
                  <h2 className="text-lg font-semibold font-[family-name:var(--font-heading)] mb-4">
                    Ce tip de problemă raportezi?
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {categories.map((cat) => (
                      <motion.button
                        key={cat.id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setCategory(cat.id)}
                        className={cn(
                          "flex flex-col items-center gap-2 p-4 rounded-xl border transition-all text-center",
                          category === cat.id
                            ? "border-primary bg-primary/10 glow-cyan"
                            : "border-border bg-surface-light/30 hover:border-primary/30"
                        )}
                      >
                        <span className="text-2xl">{cat.icon}</span>
                        <span className="text-xs font-medium">{cat.label}</span>
                      </motion.button>
                    ))}
                  </div>
                  {category === "altele" && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      className="mt-4"
                    >
                      <Input
                        placeholder="Descrie tipul de problemă..."
                        value={customCategory}
                        onChange={(e) => setCustomCategory(e.target.value)}
                      />
                    </motion.div>
                  )}
                </GlassCard>
              )}

              {/* Step 2: Location */}
              {step === 1 && (
                <GlassCard>
                  <h2 className="text-lg font-semibold font-[family-name:var(--font-heading)] mb-4">
                    Unde se află problema?
                  </h2>

                  {/* Map placeholder */}
                  <div className="h-64 rounded-xl bg-surface-light/50 border border-border mb-4 flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                      <MapPin className="h-8 w-8 mx-auto mb-2 text-primary" />
                      <p className="text-sm">Apasă pe hartă pentru a marca locația</p>
                      <p className="text-xs mt-1">Harta se va încărca aici</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
                        Adresă
                      </label>
                      <Input
                        placeholder="Caută adresă sau adaugă manual..."
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                      />
                    </div>
                    <Button variant="outline" size="sm" className="gap-2">
                      <LocateFixed className="h-4 w-4" />
                      Folosește locația mea
                    </Button>
                  </div>
                </GlassCard>
              )}

              {/* Step 3: Details */}
              {step === 2 && (
                <GlassCard>
                  <h2 className="text-lg font-semibold font-[family-name:var(--font-heading)] mb-4">
                    Detalii despre problemă
                  </h2>

                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
                        Descriere
                      </label>
                      <Textarea
                        placeholder="Descrie problema cât mai detaliat..."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={4}
                      />
                    </div>

                    {/* Photo upload */}
                    <div>
                      <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
                        Fotografii (opțional)
                      </label>
                      <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/30 transition-colors cursor-pointer">
                        <Camera className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          Trage fișierele aici sau apasă pentru a încărca
                        </p>
                        <p className="text-xs text-muted-foreground/60 mt-1">
                          PNG, JPG până la 10MB
                        </p>
                      </div>
                    </div>

                    {/* Severity */}
                    <div>
                      <label className="text-sm font-medium text-muted-foreground mb-2 block">
                        Gravitate
                      </label>
                      <div className="flex gap-2">
                        {severities.map((sev) => (
                          <motion.button
                            key={sev.id}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setSeverity(sev.id)}
                            className={cn(
                              "flex-1 py-2 rounded-lg text-xs font-medium text-white transition-all",
                              severity === sev.id
                                ? `${sev.color} ring-2 ring-offset-2 ring-offset-background`
                                : `${sev.color} opacity-40 hover:opacity-70`,
                              severity === sev.id && sev.id === "scazut" && "ring-blue-500",
                              severity === sev.id && sev.id === "mediu" && "ring-yellow-500",
                              severity === sev.id && sev.id === "ridicat" && "ring-orange-500",
                              severity === sev.id && sev.id === "critic" && "ring-red-500"
                            )}
                          >
                            {sev.label}
                          </motion.button>
                        ))}
                      </div>
                    </div>

                    {/* Seen count */}
                    <div>
                      <label className="text-sm font-medium text-muted-foreground mb-2 block">
                        Am văzut asta de câte ori?
                      </label>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((count) => (
                          <motion.button
                            key={count}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => setSeenCount(count)}
                            className={cn(
                              "h-10 w-10 rounded-lg font-medium transition-all",
                              seenCount === count
                                ? "bg-primary text-primary-foreground"
                                : "bg-surface-light text-muted-foreground hover:bg-surface-light/80"
                            )}
                          >
                            {count === 5 ? "5+" : count}
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  </div>
                </GlassCard>
              )}

              {/* Step 4: Confirmation */}
              {step === 3 && (
                <GlassCard>
                  <h2 className="text-lg font-semibold font-[family-name:var(--font-heading)] mb-4">
                    Verifică datele
                  </h2>

                  <div className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="p-3 rounded-lg bg-surface-light/30">
                        <p className="text-xs text-muted-foreground mb-1">Categorie</p>
                        <p className="text-sm font-medium flex items-center gap-2">
                          {category && (
                            <>
                              <span>{reportCategoryIcons[category]}</span>
                              {reportCategoryLabels[category]}
                            </>
                          )}
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-surface-light/30">
                        <p className="text-xs text-muted-foreground mb-1">Gravitate</p>
                        <StatusBadge
                          label={severityConfig[severity].label}
                          colorClass={severityConfig[severity].color}
                        />
                      </div>
                      <div className="p-3 rounded-lg bg-surface-light/30">
                        <p className="text-xs text-muted-foreground mb-1">Locație</p>
                        <p className="text-sm font-medium flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 text-primary" />
                          {address || "Nicio adresă specificată"}
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-surface-light/30">
                        <p className="text-xs text-muted-foreground mb-1">Frecvență</p>
                        <p className="text-sm font-medium">
                          Văzut de {seenCount === 5 ? "5+" : seenCount}{" "}
                          {seenCount === 1 ? "dată" : "ori"}
                        </p>
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-surface-light/30">
                      <p className="text-xs text-muted-foreground mb-1">Descriere</p>
                      <p className="text-sm">{description || "Nicio descriere"}</p>
                    </div>
                  </div>
                </GlassCard>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation buttons */}
        <div className="flex justify-between mt-6">
          <Button
            variant="outline"
            onClick={goPrev}
            disabled={step === 0}
            className="gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            Înapoi
          </Button>

          {step < steps.length - 1 ? (
            <Button onClick={goNext} disabled={!canProceed()} className="gap-2" animated>
              Următorul
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} variant="accent" className="gap-2" animated>
              <CheckCircle className="h-4 w-4" />
              Trimite raport
            </Button>
          )}
        </div>
      </div>
    </PageTransition>
  );
}
