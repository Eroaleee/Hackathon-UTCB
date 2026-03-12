// ============================
// User & Auth Types
// ============================

export type UserRole = "cetatean" | "admin";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  neighborhood?: string;
  joinedAt: string;
  xp: number;
  level: number;
  levelName: string;
  badges: Badge[];
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  earned: boolean;
  earnedAt?: string;
}

// ============================
// Report / Feedback Types
// ============================

export type ReportCategory =
  | "masini_parcate"
  | "gropi"
  | "constructii"
  | "drum_blocat"
  | "interferenta_pietoni"
  | "obstacole"
  | "parcari_biciclete"
  | "iluminat"
  | "altele";

export type ReportSeverity = "scazut" | "mediu" | "ridicat" | "critic";

export type ReportStatus =
  | "trimis"
  | "in_analiza"
  | "in_lucru"
  | "rezolvat"
  | "respins";

export interface Report {
  id: string;
  userId: string;
  category: ReportCategory;
  categoryLabel: string;
  severity: ReportSeverity;
  status: ReportStatus;
  title: string;
  description: string;
  location: GeoLocation;
  address: string;
  photos: string[];
  seenCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface GeoLocation {
  lat: number;
  lng: number;
}

// ============================
// Proposal Types
// ============================

export type ProposalCategory =
  | "pista_noua"
  | "parcare_biciclete"
  | "siguranta"
  | "semaforizare"
  | "infrastructura_verde"
  | "altele";

export type ProposalStatus =
  | "in_analiza"
  | "aprobat"
  | "respins"
  | "in_implementare";

export interface Proposal {
  id: string;
  userId: string;
  authorName: string;
  authorAvatar?: string;  authorRole?: "cetatean" | "admin";  category: ProposalCategory;
  categoryLabel: string;
  title: string;
  description: string;
  location: GeoLocation;
  address: string;
  images: string[];
  geometry?: any; // GeoJSON geometry drawn by citizen
  votes: number;
  userVote?: "up" | "down" | null;
  commentCount: number;
  comments: Comment[];
  status: ProposalStatus;
  createdAt: string;
}

export interface Comment {
  id: string;
  userId: string;
  authorName: string;
  authorAvatar?: string;
  authorRole?: "cetatean" | "admin";
  content: string;
  createdAt: string;
  replies: Comment[];
}

// ============================
// Project Types
// ============================

export type ProjectStage =
  | "planificat"
  | "proiectare"
  | "simulare"
  | "testare"
  | "consultare_publica"
  | "aprobare"
  | "in_lucru"
  | "finalizat";

export type ProjectType =
  | "pista_biciclete"
  | "parcare_biciclete"
  | "semaforizare"
  | "zona_30"
  | "zona_pietonala"
  | "coridor_verde"
  | "infrastructura_mixta";

export interface Project {
  id: string;
  title: string;
  description: string;
  image?: string;
  stage: ProjectStage;
  stageLabel: string;
  projectType?: ProjectType;
  budget?: string;
  timeline: string;
  team?: string;
  startDate?: string;
  endDate?: string;
  workingHours?: string;
  location: GeoLocation;
  address: string;
  geometry?: any; // GeoJSON FeatureCollection
  simulationResults?: SimulationMetrics;
  connectedRouteIds?: string[];
  proposalId?: string;
  followers: number;
  isFollowing: boolean;
  likes: number;
  commentCount: number;
  comments: Comment[];
  citizenEngagementScore: number;
  createdAt: string;
  updatedAt: string;
}

// ============================
// Infrastructure Types
// ============================

export type InfrastructureType =
  | "pista_biciclete"
  | "parcare_biciclete"
  | "semafor"
  | "zona_30"
  | "zona_pietonala";

export interface InfrastructureElement {
  id: string;
  type: InfrastructureType;
  typeLabel: string;
  name: string;
  geometry: GeoJSON.Geometry;
  properties: Record<string, string | number | boolean>;
  createdAt: string;
  updatedAt: string;
}

// ============================
// Statistics Types
// ============================

export interface DashboardStats {
  totalReports: number;
  resolvedReports: number;
  pendingReports: number;
  averageResolutionTime: string;
  totalProposals: number;
  activeProjects: number;
  activeUsers: number;
  todayReports: number;
  trends: {
    totalReports: number;
    resolvedReports: number;
    pendingReports: number;
    activeUsers: number;
  };
}

export interface ChartDataPoint {
  name: string;
  value: number;
  [key: string]: string | number;
}

// ============================
// Simulation Types
// ============================

export interface SimulationScenario {
  id: string;
  name: string;
  description: string;
  changes?: any; // GeoJSON FeatureCollection
  projectId?: string;
  metrics: SimulationMetrics;
}

export interface SimulationMetrics {
  safetyScore: number;
  coveragePercent: number;
  conflictZones: number;
  accessibilityScore: number;
}

export interface SimulationBaseline extends SimulationMetrics {
  details?: {
    totalBikeLaneKm: number;
    connectedComponents: number;
    avgSafetyPerSegment: number;
    transitStopsWithBikeAccess: number;
    totalTransitStops: number;
    conflictZoneLocations: { lat: number; lng: number; reason: string }[];
    segmentScores: { name: string; safety: number; type: string; length: number }[];
  };
}

// ============================
// Transit Types
// ============================

export interface TransitStop {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  type: number;
}

export interface TransitRoute {
  id: string;
  shortName: string;
  longName: string;
  type: number;
  color: string;
}

export interface TransitShapeCollection {
  type: "FeatureCollection";
  features: {
    type: "Feature";
    geometry: { type: string; coordinates: number[][] };
    properties: {
      shapeId: string;
      routeId: string;
      routeName: string;
      routeType: number;
      routeColor: string;
    };
  }[];
}

export interface RoadNetworkCollection {
  type: "FeatureCollection";
  features: {
    type: "Feature";
    geometry: { type: string; coordinates: number[][] };
    properties: {
      id: string;
      name: string;
      roadType: string;
      length: number;
      safetyScore: number;
      trafficLoad: number;
    };
  }[];
}

// ============================
// Notification Types
// ============================

export interface Notification {
  id: string;
  type: "report_update" | "proposal_vote" | "project_update" | "badge_earned" | "system";
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  link?: string;
}

// ============================
// Activity Types
// ============================

export interface Activity {
  id: string;
  userId: string;
  type: "report" | "proposal" | "vote" | "comment" | "badge";
  description: string;
  createdAt: string;
  link?: string;
}

// ============================
// Map Layer Types
// ============================

export type MapLayerType =
  | "heatmap_pericole"
  | "trafic_biciclete"
  | "infrastructura"
  | "proiecte"
  | "propuneri"
  | "transport_public";

export interface MapLayer {
  id: MapLayerType;
  label: string;
  color: string;
  icon: string;
  visible: boolean;
}

// ============================
// Route Planner Types
// ============================

export interface RouteSegmentInfo {
  name: string;
  roadType: string;
  safetyScore: number;
  length: number;
  coordinates: number[][];
}

export interface SafeSpot {
  lat: number;
  lng: number;
  name: string;
  type: "park" | "low_traffic" | "bike_parking" | "pedestrian_zone";
}

export interface PointOfInterest {
  lat: number;
  lng: number;
  name: string;
  type: "semafor" | "parcare_biciclete";
}

export interface BikeRouteResult {
  found: boolean;
  totalDistanceM: number;
  totalTimeMin: number;
  safetyAvg: number;
  bikeLanePercent: number;
  segments: RouteSegmentInfo[];
  safeSpots: SafeSpot[];
  pointsOfInterest: PointOfInterest[];
  geojson: {
    type: "FeatureCollection";
    features: {
      type: "Feature";
      geometry: { type: "LineString"; coordinates: number[][] };
      properties: {
        roadType: string;
        safetyScore: number;
        name: string;
        segmentIndex: number;
      };
    }[];
  };
}
