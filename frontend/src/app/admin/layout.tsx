"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart3,
  Map,
  Settings,
  FolderKanban,
  ClipboardList,
  Users,
  AlertTriangle,
  Bike,
  ChevronLeft,
  Menu,
  Activity,
  Database,
  Wifi,
  LogOut,
} from "lucide-react";
import { NotificationBell } from "@/components/ui/notification-bell";
import { useDashboardStats, useNotifications } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

const navItems = [
  { href: "/admin", label: "Statistici", icon: BarChart3 },
  { href: "/admin/infrastructura", label: "Infrastructură", icon: Map },
  { href: "/admin/simulare", label: "Simulare", icon: Settings },
  { href: "/admin/proiecte", label: "Proiecte", icon: FolderKanban },
  { href: "/admin/propuneri", label: "Propuneri cetățeni", icon: ClipboardList },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { data: dashboardStats } = useDashboardStats();
  const { data: notifications } = useNotifications();
  const { user, isLoading: authLoading, logout } = useAuth();

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "admin")) {
      router.replace("/");
    }
  }, [user, authLoading, router]);

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-warning border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        layout
        className={cn(
          "fixed lg:relative z-50 h-full flex flex-col glass-strong border-r border-border",
          "transition-transform lg:transition-none",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
        style={{ width: collapsed ? 72 : 256 }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 p-4 border-b border-border">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-warning/20 border border-warning/30">
            <Bike className="h-5 w-5 text-warning" />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                className="overflow-hidden whitespace-nowrap"
              >
                <span className="text-lg font-bold font-[family-name:var(--font-heading)]">
                  Velo<span className="text-warning">Civic</span>
                </span>
                <p className="text-[10px] text-warning">Admin Panel</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/admin" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all relative",
                  isActive
                    ? "text-warning"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface-light"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="admin-nav-active"
                    className="absolute inset-0 rounded-lg bg-warning/10 border border-warning/20"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <item.icon className="h-5 w-5 shrink-0 relative z-10" />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: "auto" }}
                      exit={{ opacity: 0, width: 0 }}
                      className="whitespace-nowrap overflow-hidden relative z-10"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </Link>
            );
          })}
        </nav>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex items-center justify-center h-10 border-t border-border text-muted-foreground hover:text-foreground transition-colors"
          aria-label={collapsed ? "Extinde meniul" : "Restrânge meniul"}
        >
          <ChevronLeft
            className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")}
          />
        </button>
      </motion.aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar with system status */}
        <header className="flex items-center justify-between px-4 lg:px-6 h-14 border-b border-border glass-strong shrink-0">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-surface-light"
              aria-label="Deschide meniul"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* System status indicators */}
            <div className="hidden md:flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <Database className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">DB OK</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <Wifi className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">API OK</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Activity className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {(dashboardStats?.activeUsers ?? 0).toLocaleString()} utilizatori activi
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <NotificationBell notifications={notifications || []} />
            <button
              onClick={() => { logout(); router.replace("/"); }}
              className="p-2 rounded-lg hover:bg-surface-light text-muted-foreground hover:text-foreground transition-colors"
              title="Deconectare"
            >
              <LogOut className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2 ml-2 pl-2 border-l border-border">
              <div className="h-8 w-8 rounded-full bg-warning/20 flex items-center justify-center text-xs font-bold text-warning">
                {user.nickname?.[0]?.toUpperCase() || "A"}
              </div>
              <span className="text-sm font-medium hidden sm:inline">{user.nickname || "Admin"}</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
