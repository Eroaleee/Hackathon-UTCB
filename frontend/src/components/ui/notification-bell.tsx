"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Bell, CheckCheck, Check, FileText, ThumbsUp, FolderKanban, Award, Info } from "lucide-react";
import { useState } from "react";
import { apiPatch } from "@/lib/api";
import type { Notification } from "@/types";
import { cn } from "@/lib/utils";

const typeIcons: Record<string, typeof Bell> = {
  report_update: FileText,
  proposal_vote: ThumbsUp,
  project_update: FolderKanban,
  badge_earned: Award,
  system: Info,
};

interface NotificationBellProps {
  notifications: Notification[];
  onMutate?: () => void;
  className?: string;
}

export function NotificationBell({ notifications, onMutate, className }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = async (id: string) => {
    try {
      await apiPatch(`/notifications/${id}/read`);
      onMutate?.();
    } catch { /* ignore */ }
  };

  const markAllAsRead = async () => {
    try {
      await apiPatch("/notifications/read-all");
      onMutate?.();
    } catch { /* ignore */ }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (expanded === notification.id) {
      setExpanded(null);
    } else {
      setExpanded(notification.id);
      if (!notification.read) {
        markAsRead(notification.id);
      }
    }
  };

  return (
    <div className={cn("relative", className)}>
      <button
        onClick={() => setOpen(!open)}
        className="relative rounded-lg p-2 hover:bg-surface-light transition-colors"
        aria-label={`Notificări - ${unreadCount} necitite`}
      >
        <Bell className="h-5 w-5 text-muted-foreground" />
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white"
          >
            {unreadCount}
          </motion.span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={0.4}
              onDragEnd={(_, info) => {
                if (info.offset.y < -40) setOpen(false);
              }}
              className="absolute right-0 top-full z-50 mt-2 w-80 sm:w-96 glass-strong rounded-xl shadow-xl overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <h3 className="text-sm font-semibold font-[family-name:var(--font-heading)]">
                  Notificări {unreadCount > 0 && <span className="text-primary">({unreadCount})</span>}
                </h3>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 transition-colors font-medium"
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    Marchează toate
                  </button>
                )}
              </div>

              {/* Notification list */}
              <div className="max-h-[60vh] sm:max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center">
                    <Bell className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Nicio notificare</p>
                  </div>
                ) : (
                  notifications.map((notification) => {
                    const Icon = typeIcons[notification.type] || Bell;
                    const isExpanded = expanded === notification.id;
                    return (
                      <div key={notification.id}>
                        <div
                          onClick={() => handleNotificationClick(notification)}
                          className={cn(
                            "flex gap-3 px-4 py-3 transition-colors hover:bg-surface-light cursor-pointer border-b border-border/50 last:border-0",
                            !notification.read && "bg-primary/5"
                          )}
                        >
                          <div className={cn(
                            "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                            !notification.read ? "bg-primary/15 text-primary" : "bg-surface-light text-muted-foreground"
                          )}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <p className={cn("text-sm truncate", !notification.read ? "font-semibold" : "font-medium")}>
                                {notification.title}
                              </p>
                              {!notification.read && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); markAsRead(notification.id); }}
                                  className="shrink-0 p-1 rounded hover:bg-primary/10 text-primary transition-colors"
                                  title="Marchează ca citit"
                                >
                                  <Check className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                            <p className={cn("text-xs text-muted-foreground mt-0.5", isExpanded ? "" : "line-clamp-1")}>
                              {notification.message}
                            </p>
                            <p className="text-[10px] text-muted-foreground/60 mt-1">
                              {new Date(notification.createdAt).toLocaleDateString("ro-RO", {
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
