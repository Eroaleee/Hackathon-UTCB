"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home,
  Megaphone,
  Lightbulb,
  Map,
  FolderKanban,
  User,
  Bike,
  ChevronLeft,
  Menu,
  LogOut,
  LogIn,
} from "lucide-react";
import { NotificationBell } from "@/components/ui/notification-bell";
import { useCurrentUser, useNotifications } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

const navItems = [
  { href: "/cetatean", label: "Acasă", icon: Home },
  { href: "/cetatean/feedback", label: "Raportează problemă", icon: Megaphone },
  { href: "/cetatean/propuneri", label: "Propuneri", icon: Lightbulb },
  { href: "/cetatean/harta", label: "Hartă interactivă", icon: Map },
  { href: "/cetatean/proiecte", label: "Proiecte viitoare", icon: FolderKanban },
  { href: "/cetatean/profil", label: "Profilul meu", icon: User },
];

export default function CetateanLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { data: currentUser } = useCurrentUser();
  const { data: notifications, mutate: mutateNotifications } = useNotifications();
  const { user: authUser, isGuest, isLoading: authLoading, logout } = useAuth();

  useEffect(() => {
    if (!authLoading && !authUser && !isGuest) {
      router.replace("/");
    }
  }, [authUser, isGuest, authLoading, router]);

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!authUser && !isGuest) {
    return null;
  }

  const isLoggedIn = !!authUser;
  const userName = isLoggedIn ? (currentUser?.name || authUser.nickname || "Utilizator") : "Vizitator";
  const userInitials = isLoggedIn ? userName.split(" ").map((n) => n[0]).join("") : "?";
  const userLevel = isLoggedIn ? (currentUser?.levelName || "") : "";
  const userXp = isLoggedIn ? (currentUser?.xp || 0) : 0;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1100] bg-black/60 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        layout
        className={cn(
          "fixed lg:relative z-[1200] h-full flex flex-col glass-strong border-r border-border",
          "transition-transform lg:transition-none",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
        style={{ width: collapsed ? 72 : 256 }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 p-4 border-b border-border">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/20 border border-primary/30">
            <Bike className="h-5 w-5 text-primary" />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                className="text-lg font-bold font-[family-name:var(--font-heading)] whitespace-nowrap overflow-hidden"
              >
                Velo<span className="text-primary">Civic</span>
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/cetatean" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all relative",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface-light"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="citizen-nav-active"
                    className="absolute inset-0 rounded-lg bg-primary/10 border border-primary/20"
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
        {/* Top bar */}
        <header className="relative z-[1100] flex items-center justify-between px-4 lg:px-6 h-14 border-b border-border glass-strong shrink-0">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-surface-light"
              aria-label="Deschide meniul"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="hidden lg:block" />
          </div>

          <div className="flex items-center gap-2">
            <NotificationBell notifications={notifications || []} onMutate={mutateNotifications} />
            {isLoggedIn ? (
              <>
                <button
                  onClick={() => { logout(); router.replace("/"); }}
                  className="p-2 rounded-lg hover:bg-surface-light text-muted-foreground hover:text-foreground transition-colors"
                  title="Deconectare"
                >
                  <LogOut className="h-4 w-4" />
                </button>
                <div className="flex items-center gap-2 ml-2 pl-2 border-l border-border">
                  <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                    {userInitials}
                  </div>
                  <div className="hidden sm:block">
                    <span className="text-sm font-medium">{userName}</span>
                    <p className="text-[10px] text-muted-foreground">{userLevel} — {userXp} XP</p>
                  </div>
                </div>
              </>
            ) : (
              <Link
                href="/"
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-primary hover:bg-primary/10 transition-colors"
              >
                <LogIn className="h-4 w-4" />
                <span className="hidden sm:inline">Conectează-te</span>
              </Link>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
