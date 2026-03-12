import useSWR from "swr";
import type {
  DashboardStats,
  Report,
  Proposal,
  Project,
  Comment,
  Notification,
  Activity,
  SimulationScenario,
  SimulationBaseline,
  TransitStop,
  TransitRoute,
  TransitShapeCollection,
  RoadNetworkCollection,
  User,
  Badge,
  BikeRouteResult,
} from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("velocivic_session_token");
}

async function fetcher<T>(url: string): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers["x-session-token"] = token;
  const res = await fetch(url, { headers });
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
    authorRole: p.authorRole || p.user?.role || "cetatean",
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
    comments: (p.comments ?? []).map(transformComment),
    geometry: p.geometry || undefined,
    status: p.status,
    createdAt: p.createdAt,
  };
}

function transformComment(c: any): Comment {
  return {
    id: c.id,
    userId: c.userId,
    authorName: c.user?.nickname || c.authorName || "",
    authorRole: c.user?.role || c.authorRole || "cetatean",
    content: c.content,
    createdAt: c.createdAt,
    replies: (c.replies ?? []).map(transformComment),
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
    projectType: p.projectType || "infrastructura_mixta",
    budget: p.budget || "",
    timeline: p.timeline,
    team: p.team || "",
    startDate: p.startDate || undefined,
    endDate: p.endDate || undefined,
    workingHours: p.workingHours || undefined,
    location: { lat: p.latitude, lng: p.longitude },
    address: p.address,
    followers: p.followers ?? p._count?.followers ?? 0,
    isFollowing: p.isFollowing ?? false,
    likes: p.likes ?? p._count?.likes ?? 0,
    commentCount: p.commentCount ?? p._count?.comments ?? 0,
    comments: (p.comments ?? []).map(transformComment),
    citizenEngagementScore: p.citizenEngagementScore ?? 0,
    geometry: p.geometry || null,
    simulationResults: p.simulationResults || undefined,
    connectedRouteIds: p.connectedRouteIds || [],
    proposalId: p.proposalId || undefined,
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
  const token = getToken();
  const { data, ...rest } = useSWR<any>(token ? [`${API_BASE}/auth/me`, token] : null, ([url]) => fetcher(url));
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
        level: computeLevel(data.xp ?? 0),
        levelName: computeLevelName(data.xp ?? 0),
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

export const LEVEL_THRESHOLDS = [0, 50, 150, 300, 600, 1000];
export const LEVEL_NAMES = ["Începător", "Biciclist Activ", "Activist Urban", "Campion Civic", "Legendă Urbană"];

function computeLevel(xp: number): number {
  let lvl = 0;
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]) { lvl = i; break; }
  }
  return lvl;
}

function computeLevelName(xp: number): string {
  const lvl = computeLevel(xp);
  return LEVEL_NAMES[Math.min(lvl, LEVEL_NAMES.length - 1)];
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
  const token = getToken();
  return useSWR<{
    reportsSubmitted: number;
    proposalsVoted: number;
    activeProjects: number;
    pointsEarned: number;
    proposalsSubmitted: number;
    commentsCount: number;
  }>(token ? [`${API_BASE}/stats/citizen`, token] : null, ([url]) => fetcher(url));
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
  const token = getToken();
  return useSWR<Notification[]>(token ? [`${API_BASE}/notifications`, token] : null, ([url]) => fetcher(url));
}

export function useActivities() {
  const token = getToken();
  return useSWR<Activity[]>(token ? [`${API_BASE}/activities`, token] : null, ([url]) => fetcher(url));
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
      count: number;
    }[]
  >(`${API_BASE}/infrastructure/layers`, fetcher);
}

export function useInfrastructureElements() {
  return useSWR<any[]>(`${API_BASE}/infrastructure`, fetcher);
}

export function useRoadNodes() {
  return useSWR<{ id: string; latitude: number; longitude: number; name: string }[]>(
    `${API_BASE}/infrastructure/road-nodes`,
    fetcher
  );
}

export function useSimulationBaseline() {
  return useSWR<SimulationBaseline>(`${API_BASE}/simulations/baseline`, fetcher);
}

// ============================
// Transit hooks
// ============================

export function useTransitStops(bounds?: { minLat: number; maxLat: number; minLng: number; maxLng: number }) {
  const params = bounds
    ? `?minLat=${bounds.minLat}&maxLat=${bounds.maxLat}&minLng=${bounds.minLng}&maxLng=${bounds.maxLng}`
    : "";
  return useSWR<TransitStop[]>(`${API_BASE}/transit/stops${params}`, fetcher);
}

export function useTransitRoutes(type?: string) {
  const params = type ? `?type=${type}` : "";
  return useSWR<TransitRoute[]>(`${API_BASE}/transit/routes${params}`, fetcher);
}

export function useTransitShapes() {
  return useSWR<TransitShapeCollection>(`${API_BASE}/transit/shapes`, fetcher);
}

// ============================
// Road network hook
// ============================

export function useRoadNetwork() {
  return useSWR<RoadNetworkCollection>(`${API_BASE}/simulations/network/roads`, fetcher);
}

// ============================
// Simulation mutation helpers
// ============================

export async function createScenario(body: { name: string; description?: string; changes?: any; projectId?: string }) {
  return apiPost("/simulations", body);
}

export async function updateScenario(id: string, body: { name?: string; description?: string; changes?: any }) {
  return apiPut(`/simulations/${id}`, body);
}

export async function runScenario(id: string) {
  return apiPost(`/simulations/${id}/run`);
}

export async function previewSimulation(changes: any) {
  return apiPost("/simulations/preview", { changes });
}

export async function deleteScenario(id: string) {
  return apiDelete(`/simulations/${id}`);
}

// ============================
// Mutation helpers
// ============================

async function extractError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    return data.error || `API error: ${res.status}`;
  } catch {
    return `API error: ${res.status}`;
  }
}

export async function apiPost(path: string, body?: unknown) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers["x-session-token"] = token;
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(await extractError(res));
  return res.json();
}

export async function apiPatch(path: string, body?: unknown) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers["x-session-token"] = token;
  const res = await fetch(`${API_BASE}${path}`, {
    method: "PATCH",
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(await extractError(res));
  return res.json();
}

export async function apiPut(path: string, body?: unknown) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers["x-session-token"] = token;
  const res = await fetch(`${API_BASE}${path}`, {
    method: "PUT",
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(await extractError(res));
  return res.json();
}

export async function apiDelete(path: string) {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers["x-session-token"] = token;
  const res = await fetch(`${API_BASE}${path}`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) throw new Error(await extractError(res));
  return res.json();
}

// ============================
// Route planner
// ============================

export async function planBikeRoute(
  startLat: number, startLng: number, endLat: number, endLng: number
): Promise<BikeRouteResult> {
  return apiPost("/routes/plan", { startLat, startLng, endLat, endLng });
}
