"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { useSWRConfig } from "swr";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

export interface AuthUser {
  id: string;
  nickname: string;
  email: string | null;
  role: "cetatean" | "admin";
  sessionToken: string;
  xp: number;
  level: number;
  levelName: string;
  neighborhood: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (nickname: string, email: string, password: string, neighborhood?: string) => Promise<AuthUser>;
  loginAsGuest: () => void;
  logout: () => void;
  isGuest: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_KEY = "velocivic_session_token";
const USER_KEY = "velocivic_user";
const GUEST_KEY = "velocivic_guest";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);
  const { mutate } = useSWRConfig();

  // Restore session on mount
  useEffect(() => {
    const stored = localStorage.getItem(USER_KEY);
    const token = localStorage.getItem(TOKEN_KEY);
    const guest = localStorage.getItem(GUEST_KEY);

    if (stored && token) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        localStorage.removeItem(USER_KEY);
        localStorage.removeItem(TOKEN_KEY);
      }
    } else if (guest === "true") {
      setIsGuest(true);
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<AuthUser> => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Autentificare eșuată.");
    }

    const data = await res.json();
    const authUser: AuthUser = {
      id: data.id,
      nickname: data.nickname,
      email: data.email,
      role: data.role,
      sessionToken: data.sessionToken,
      xp: data.xp,
      level: data.level,
      levelName: data.levelName,
      neighborhood: data.neighborhood,
    };

    localStorage.setItem(TOKEN_KEY, authUser.sessionToken);
    localStorage.setItem(USER_KEY, JSON.stringify(authUser));
    localStorage.removeItem(GUEST_KEY);
    // Clear stale SWR cache before setting new user
    mutate(() => true, undefined, { revalidate: false });
    setUser(authUser);
    setIsGuest(false);
    return authUser;
  }, [mutate]);

  const register = useCallback(async (nickname: string, email: string, password: string, neighborhood?: string): Promise<AuthUser> => {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname, email, password, neighborhood }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Înregistrare eșuată.");
    }

    const data = await res.json();
    const authUser: AuthUser = {
      id: data.id,
      nickname: data.nickname,
      email: data.email,
      role: data.role,
      sessionToken: data.sessionToken,
      xp: data.xp,
      level: data.level,
      levelName: data.levelName,
      neighborhood: data.neighborhood,
    };

    localStorage.setItem(TOKEN_KEY, authUser.sessionToken);
    localStorage.setItem(USER_KEY, JSON.stringify(authUser));
    localStorage.removeItem(GUEST_KEY);
    mutate(() => true, undefined, { revalidate: false });
    setUser(authUser);
    setIsGuest(false);
    return authUser;
  }, [mutate]);

  const loginAsGuest = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.setItem(GUEST_KEY, "true");
    mutate(() => true, undefined, { revalidate: false });
    setUser(null);
    setIsGuest(true);
  }, [mutate]);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(GUEST_KEY);
    setUser(null);
    setIsGuest(false);
    // Clear all SWR cache so next user gets fresh data
    mutate(() => true, undefined, { revalidate: false });
  }, [mutate]);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, loginAsGuest, logout, isGuest }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

export function getSessionToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}
