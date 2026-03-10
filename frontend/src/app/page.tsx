"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Bike, Mail, Lock, Eye, EyeOff, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GlassCard } from "@/components/ui/glass-card";
import { useRouter } from "next/navigation";

type UserMode = "cetatean" | "admin";

export default function LoginPage() {
  const [mode, setMode] = useState<UserMode>("cetatean");
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "cetatean") {
      router.push("/cetatean");
    } else {
      router.push("/admin");
    }
  };

  const heatmapDots = useMemo(
    () => [
      { id: 0, x: 12.3, y: 60.9, delay: 0.4, size: 5.2 },
      { id: 1, x: 53.9, y: 59.9, delay: 1.2, size: 3.5 },
      { id: 2, x: 30.5, y: 18.0, delay: 2.7, size: 5.0 },
      { id: 3, x: 35.5, y: 74.3, delay: 0.8, size: 4.7 },
      { id: 4, x: 17.4, y: 82.2, delay: 1.5, size: 8.9 },
      { id: 5, x: 44.7, y: 36.9, delay: 2.1, size: 3.7 },
      { id: 6, x: 36.9, y: 35.3, delay: 0.2, size: 5.1 },
      { id: 7, x: 87.9, y: 45.9, delay: 1.8, size: 6.4 },
      { id: 8, x: 59.0, y: 28.7, delay: 0.6, size: 8.3 },
      { id: 9, x: 88.8, y: 66.0, delay: 2.4, size: 7.9 },
      { id: 10, x: 31.8, y: 78.3, delay: 1.0, size: 8.9 },
      { id: 11, x: 51.9, y: 18.0, delay: 0.3, size: 7.0 },
      { id: 12, x: 83.6, y: 68.0, delay: 2.9, size: 6.6 },
      { id: 13, x: 44.4, y: 52.6, delay: 1.7, size: 6.5 },
      { id: 14, x: 45.0, y: 49.7, delay: 0.9, size: 5.4 },
      { id: 15, x: 85.9, y: 83.3, delay: 2.3, size: 3.9 },
      { id: 16, x: 77.0, y: 62.9, delay: 0.1, size: 8.2 },
      { id: 17, x: 71.5, y: 52.3, delay: 1.4, size: 4.5 },
      { id: 18, x: 76.3, y: 57.3, delay: 2.6, size: 6.2 },
      { id: 19, x: 22.9, y: 87.5, delay: 0.7, size: 8.4 },
      { id: 20, x: 70.7, y: 63.5, delay: 1.9, size: 6.6 },
      { id: 21, x: 81.3, y: 66.2, delay: 2.0, size: 7.0 },
      { id: 22, x: 66.6, y: 85.9, delay: 0.5, size: 8.9 },
      { id: 23, x: 89.7, y: 85.3, delay: 1.1, size: 5.1 },
      { id: 24, x: 64.5, y: 75.1, delay: 2.8, size: 6.8 },
      { id: 25, x: 54.6, y: 31.2, delay: 0.0, size: 4.3 },
      { id: 26, x: 83.7, y: 63.9, delay: 1.6, size: 4.3 },
      { id: 27, x: 82.9, y: 61.8, delay: 2.2, size: 5.0 },
      { id: 28, x: 40.8, y: 19.8, delay: 1.3, size: 8.1 },
      { id: 29, x: 51.4, y: 56.5, delay: 2.5, size: 5.1 },
    ],
    []
  );

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Animated City Background */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-background via-surface to-background items-center justify-center">
        <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
          {Array.from({ length: 20 }).map((_, i) => (
            <motion.line
              key={`h-${i}`}
              x1="0"
              y1={`${(i + 1) * 5}%`}
              x2="100%"
              y2={`${(i + 1) * 5}%`}
              stroke="rgba(0,212,255,0.05)"
              strokeWidth="1"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 2, delay: i * 0.05 }}
            />
          ))}
          {Array.from({ length: 20 }).map((_, i) => (
            <motion.line
              key={`v-${i}`}
              x1={`${(i + 1) * 5}%`}
              y1="0"
              x2={`${(i + 1) * 5}%`}
              y2="100%"
              stroke="rgba(0,212,255,0.05)"
              strokeWidth="1"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 2, delay: i * 0.05 }}
            />
          ))}
          <motion.path
            d="M 0 300 Q 200 250 400 350 Q 600 450 800 300"
            stroke="rgba(0,212,255,0.15)"
            strokeWidth="3"
            fill="none"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 3, ease: "easeInOut" }}
          />
          <motion.path
            d="M 100 0 Q 150 200 300 400 Q 400 600 200 800"
            stroke="rgba(163,230,53,0.12)"
            strokeWidth="2"
            fill="none"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 3.5, ease: "easeInOut", delay: 0.5 }}
          />
          <motion.path
            d="M 600 0 Q 500 300 700 500 Q 800 600 650 800"
            stroke="rgba(163,230,53,0.1)"
            strokeWidth="2"
            fill="none"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 3, ease: "easeInOut", delay: 1 }}
          />
        </svg>

        {heatmapDots.map((dot) => (
          <motion.div
            key={dot.id}
            className="absolute rounded-full"
            style={{
              left: `${dot.x}%`,
              top: `${dot.y}%`,
              width: dot.size,
              height: dot.size,
              backgroundColor:
                dot.id % 3 === 0
                  ? "rgba(0,212,255,0.6)"
                  : dot.id % 3 === 1
                  ? "rgba(163,230,53,0.5)"
                  : "rgba(245,158,11,0.5)",
            }}
            animate={{
              scale: [1, 1.8, 1],
              opacity: [0.3, 0.8, 0.3],
            }}
            transition={{
              duration: 2 + Math.random() * 2,
              delay: dot.delay,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}

        <div className="relative z-10 text-center px-12">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
          >
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/20 border border-primary/30">
                <Bike className="h-8 w-8 text-primary" />
              </div>
              <h1 className="text-4xl font-bold font-[family-name:var(--font-heading)] text-foreground">
                Velo<span className="text-primary">Civic</span>
              </h1>
            </div>
            <p className="text-xl text-muted-foreground max-w-md mx-auto leading-relaxed">
              Platformă civică pentru mobilitate urbană și infrastructură ciclabilă
            </p>
            <div className="mt-8 flex items-center justify-center gap-8 text-sm text-muted-foreground">
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">8.9K+</p>
                <p>Utilizatori activi</p>
              </div>
              <div className="h-8 w-px bg-border" />
              <div className="text-center">
                <p className="text-2xl font-bold text-accent">1.5K+</p>
                <p>Rapoarte trimise</p>
              </div>
              <div className="h-8 w-px bg-border" />
              <div className="text-center">
                <p className="text-2xl font-bold text-warning">312</p>
                <p>Propuneri</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 lg:p-12">
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="w-full max-w-md"
        >
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 border border-primary/30">
              <Bike className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-2xl font-bold font-[family-name:var(--font-heading)]">
              Velo<span className="text-primary">Civic</span>
            </h1>
          </div>

          <GlassCard className="p-8" glowing>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
            >
              <h2 className="text-2xl font-bold font-[family-name:var(--font-heading)] mb-1">
                Construim orașul împreună
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                Conectează-te pentru a contribui la infrastructura ciclabilă
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              className="mb-6"
            >
              <div className="flex rounded-lg bg-surface-light p-1">
                {(["cetatean", "admin"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className="relative flex-1 rounded-md py-2 text-sm font-medium transition-colors"
                  >
                    {mode === m && (
                      <motion.div
                        layoutId="mode-indicator"
                        className={`absolute inset-0 rounded-md ${
                          m === "cetatean"
                            ? "bg-primary/20 border border-primary/30"
                            : "bg-warning/20 border border-warning/30"
                        }`}
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      />
                    )}
                    <span className="relative z-10">
                      {m === "cetatean" ? "🏠 Cetățean" : "⚙️ Administrator"}
                    </span>
                  </button>
                ))}
              </div>
            </motion.div>

            <form onSubmit={handleLogin} className="space-y-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.5 }}
              >
                <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="email@exemplu.ro"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7, duration: 0.5 }}
              >
                <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
                  Parolă
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8, duration: 0.5 }}
                className="flex items-center justify-between"
              >
                <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded border-border bg-surface h-4 w-4 accent-primary"
                  />
                  Ține-mă minte
                </label>
                <button
                  type="button"
                  className="text-sm text-primary hover:text-primary/80 transition-colors"
                >
                  Ai uitat parola?
                </button>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9, duration: 0.5 }}
              >
                <Button type="submit" variant="shimmer" size="lg" animated className="w-full">
                  Conectează-te
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </motion.div>
            </form>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1, duration: 0.5 }}
              className="text-center text-xs text-muted-foreground mt-6"
            >
              Nu ai cont?{" "}
              <button className="text-primary hover:text-primary/80 transition-colors font-medium">
                Înregistrează-te
              </button>
            </motion.p>
          </GlassCard>
        </motion.div>
      </div>
    </div>
  );
}
