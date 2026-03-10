"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle, Star } from "lucide-react";
import { useEffect, useState } from "react";

interface XPToastProps {
  points: number;
  message: string;
  visible: boolean;
  onClose: () => void;
}

export function XPToast({ points, message, visible, onClose }: XPToastProps) {
  useEffect(() => {
    if (visible) {
      const timer = setTimeout(onClose, 4000);
      return () => clearTimeout(timer);
    }
  }, [visible, onClose]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.9 }}
          className="fixed bottom-6 right-6 z-50 glass-strong rounded-xl p-4 glow-lime flex items-center gap-3"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/20">
            <Star className="h-5 w-5 text-accent" />
          </div>
          <div>
            <p className="text-sm font-semibold text-accent">+{points} XP</p>
            <p className="text-xs text-muted-foreground">{message}</p>
          </div>
          <button onClick={onClose} className="ml-2 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
