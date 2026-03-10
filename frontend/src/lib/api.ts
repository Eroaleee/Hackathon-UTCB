import useSWR from "swr";
import type {
  DashboardStats,
  Report,
  Proposal,
  Project,
  Notification,
  Activity,
  SimulationScenario,
  User,
  Badge,
} from "@/types";

const API_BASE = "http://localhost:3001/api";

const SESSION_TOKEN = "session-andrei-popescu";

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { "x-session-token": SESSION_TOKEN },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// Transform backend report (latitude/longitude + photos[]) to frontend Report type
function transformReport(r: any): Report {
  return {
    id: r.id,
    userId: r.userId,
    category: r.category,
    categoryLabel: r.categoryLabel,
    severity: r.severity,
    status: r.status,
    title: r.title,
    description: r.description,
    location: { lat: r.latitude, lng: r.longitude },
    address: r.address,
    photos: r.photos?.map((p: any) => p.url) ?? [],
    seenCount: r.seenCount,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

// Transform backend proposal to frontend Proposal type
function transformProposal(p: any): Proposal {
  return {
    id: p.id,
    userId: p.userId,
    authorName: p.authorName || p.user?.nickname || "",
    authorAvatar: p.authorAvatar || p.user?.avatar || undefined,
    category: p.category,
    categoryLabel: p.categoryLabel,
    title: p.title,
    description: p.description,
    location: { lat: p.latitude, lng: p.longitude },
    address: p.address,
    images: p.images?.map((i: any) => (typeof i === "string" ? i : i.url)) ?? [],
    votes: p.votes ?? 0,
    userVote: p.userVote ?? null,
    commentCount: p.commentCount ?? p._count?.comments ?? 0,
    comments: (p.comments ?? []).map((c: any) => ({
      id: c.id,
      userId: c.userId,
      authorName: c.user?.nickname || c.authorName || "",
      content: c.content,
      createdAt: c.createdAt,
      replies: (c.replies ?? []).map((r: any) => ({
        id: r.id,
        userId: r.userId,
        authorName: r.user?.nickname || r.authorName || "",
        content: r.content,
        createdAt: r.createdAt,
        replies: [],
      })),
    })),
    status: p.status,
    createdAt: p.createdAt,
  };
}

// Transform backend project to frontend Project type
function transformProject(p: any): Project {
  return {
    id: p.id,
    title: p.title,
    description: p.description,
    image: p.image || "",
    stage: p.stage,
    stageLabel: p.stageLabel,
    budget: p.budget || "",
    timeline: p.timeline,
    team: p.team || "",
    location: { lat: p.latitude, lng: p.longitude },
    address: p.address,
    followers: p.followers ?? p._count?.followers ?? 0,
    isFollowing: p.isFollowing ?? false,
    likes: p.likes ?? p._count?.likes ?? 0,
    commentCount: p.commentCount ?? p._count?.comments ?? 0,
    comments: (p.comments ?? []).map((c: any) => ({
      id: c.id,
      userId: c.userId,
      authorName: c.user?.nickname || c.authorName || "",
      content: c.content,
      createdAt: c.createdAt,
      replies: (c.replies ?? []).map((r: any) => ({
        id: r.id,
        userId: r.userId,
        authorName: r.user?.nickname || r.authorName || "",
        content: r.content,
        createdAt: r.createdAt,
        replies: [],
      })),
    })),
    citizenEngagementScore: p.citizenEngagementScore ?? 0,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

// Current user info (will be fetched from API)
const defaultUser: User = {
  id: "",
  name: "",
  email: "",
  role: "cetatean",
  xp: 0,
  level: 0,
  levelName: "Începător",
  joinedAt: new Date().toISOString(),
  badges: [],
};

export function useCurrentUser() {
  const { data, ...rest } = useSWR<any>(`${API_BASE}/auth/me`, fetcher);
  const user: User | undefined = data
    ? {
        id: data.id,
        name: data.nickname,
        email: data.email || "",
        role: data.role,
        avatar: data.avatar || "",
        neighborhood: data.neighborhood || "",
        joinedAt: data.createdAt,
        xp: data.xp ?? 0,
        level: data.level ?? Math.floor((data.xp ?? 0) / 500),
        levelName: data.levelName ?? getLevelName(Math.floor((data.xp ?? 0) / 500)),
        badges: (data.badges ?? []).map((ub: any) => ({
          id: ub.badge?.id || ub.id,
          name: ub.badge?.name || ub.name,
          description: ub.badge?.description || ub.description,
          icon: ub.badge?.icon || ub.icon,
          earned: true,
          earnedAt: ub.earnedAt,
        })),
      }
    : undefined;
  return { data: user, ...rest };
}

function getLevelName(level: number): string {
  const names = ["Începător", "Biciclist Activ", "Activist Urban", "Campion Civic", "Legendă Urbană"];
  return names[Math.min(level, names.length - 1)];
}

export function useBadges() {
  return useSWR<Badge[]>(`${API_BASE}/auth/badges`, {
    fetcher: async (url: string): Promise<Badge[]> => {
      try {
        return await fetcher(url) as Badge[];
      } catch {
        return [];
      }
    },
  });
}

// ============================
// Stats hooks
// ============================

export function useDashboardStats() {
  return useSWR<DashboardStats>(`${API_BASE}/stats/dashboard`, fetcher);
}

export function useCitizenStats() {
  return useSWR<{
    reportsSubmitted: number;
    proposalsVoted: number;
    activeProjects: number;
    pointsEarned: number;
  }>(`${API_BASE}/stats/citizen`, fetcher);
}

export function useReportsByCategory() {
  return useSWR<{ name: string; value: number }[]>(
    `${API_BASE}/stats/reports-by-category`,
    fetcher
  );
}

export function useProposalsByStatus() {
  return useSWR<{ name: string; value: number; fill: string }[]>(
    `${API_BASE}/stats/proposals-by-status`,
    fetcher
  );
}

export function useReportsOverTime() {
  return useSWR<{ name: string; rapoarte: number; rezolvate: number }[]>(
    `${API_BASE}/stats/reports-over-time`,
    fetcher
  );
}

export function useHeatmapData() {
  return useSWR<{ date: string; count: number }[]>(
    `${API_BASE}/stats/heatmap`,
    fetcher
  );
}

// ============================
// Data hooks
// ============================

export function useReports(filters?: { status?: string; category?: string; severity?: string }) {
  const params = new URLSearchParams();
  if (filters?.status) params.set("status", filters.status);
  if (filters?.category) params.set("category", filters.category);
  if (filters?.severity) params.set("severity", filters.severity);
  const qs = params.toString();
  const { data, ...rest } = useSWR<any[]>(
    `${API_BASE}/reports${qs ? `?${qs}` : ""}`,
    fetcher
  );
  return { data: data?.map(transformReport), ...rest };
}

export function useProposals(filters?: { status?: string; category?: string }) {
  const params = new URLSearchParams();
  if (filters?.status) params.set("status", filters.status);
  if (filters?.category) params.set("category", filters.category);
  const qs = params.toString();
  const { data, ...rest } = useSWR<any[]>(
    `${API_BASE}/proposals${qs ? `?${qs}` : ""}`,
    fetcher
  );
  return { data: data?.map(transformProposal), ...rest };
}

export function useProjects() {
  const { data, ...rest } = useSWR<any[]>(`${API_BASE}/projects`, fetcher);
  return { data: data?.map(transformProject), ...rest };
}

export function useNotifications() {
  return useSWR<Notification[]>(`${API_BASE}/notifications`, fetcher);
}

export function useActivities() {
  return useSWR<Activity[]>(`${API_BASE}/activities`, fetcher);
}

export function useSimulations() {
  return useSWR<SimulationScenario[]>(`${API_BASE}/simulations`, fetcher);
}

export function useInfrastructureLayers() {
  return useSWR<
    {
      id: string;
      type: string;
      label: string;
      color: string;
      icon: string;
      isDefaultVisible: boolean;
    }[]
  >(`${API_BASE}/infrastructure/layers`, fetcher);
}

// ============================
// Mutation helpers
// ============================

export async function apiPost(path: string, body?: unknown) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-session-token": SESSION_TOKEN,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function apiPatch(path: string, body?: unknown) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "x-session-token": SESSION_TOKEN,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}
