import type {
  MapLayer,
} from "@/types";

// ============================
// Report Config
// ============================

export const reportCategoryLabels: Record<string, string> = {
  masini_parcate: "Mașini parcate pe piste",
  gropi: "Gropi / deteriorări",
  constructii: "Construcții blocante",
  drum_blocat: "Drum blocat",
  interferenta_pietoni: "Interferență cu pietonii",
  obstacole: "Obstacole pe drumuri",
  parcari_biciclete: "Parcări de biciclete proaste",
  iluminat: "Iluminat insuficient",
  altele: "Altele",
};

export const reportCategoryIcons: Record<string, string> = {
  masini_parcate: "car",
  gropi: "circle-dot",
  constructii: "construction",
  drum_blocat: "ban",
  interferenta_pietoni: "person-standing",
  obstacole: "alert-triangle",
  parcari_biciclete: "parking",
  iluminat: "lightbulb",
  altele: "map-pin",
};

// ============================
// Proposal Config
// ============================

export const proposalCategoryLabels: Record<string, string> = {
  pista_noua: "Pistă nouă",
  parcare_biciclete: "Parcare biciclete",
  siguranta: "Siguranță",
  semaforizare: "Semaforizare",
  infrastructura_verde: "Infrastructură verde",
  altele: "Altele",
};

// ============================
// Map Layers
// ============================

export const defaultMapLayers: MapLayer[] = [
  { id: "heatmap_pericole", label: "Heatmap pericole", color: "#ef4444", icon: "danger", visible: true },
  { id: "trafic_biciclete", label: "Trafic biciclete", color: "#f59e0b", icon: "traffic", visible: false },
  { id: "infrastructura", label: "Infrastructură existentă", color: "#a3e635", icon: "infra", visible: true },
  { id: "proiecte", label: "Proiecte în desfășurare", color: "#00d4ff", icon: "project", visible: false },
  { id: "propuneri", label: "Propuneri cetățeni", color: "#a855f7", icon: "proposal", visible: false },
  { id: "transport_public", label: "Transport public", color: "#f472b6", icon: "transit", visible: false },
];

// ============================
// Severity & Status Configs
// ============================

export const severityConfig = {
  scazut: { label: "Scăzut", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  mediu: { label: "Mediu", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  ridicat: { label: "Ridicat", color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  critic: { label: "Critic", color: "bg-red-500/20 text-red-400 border-red-500/30" },
};

export const reportStatusConfig = {
  trimis: { label: "Trimis", color: "bg-slate-500/20 text-slate-400 border-slate-500/30" },
  in_analiza: { label: "În analiză", color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" },
  in_lucru: { label: "În lucru", color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  rezolvat: { label: "Rezolvat", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  respins: { label: "Respins", color: "bg-red-500/20 text-red-400 border-red-500/30" },
};

export const proposalStatusConfig = {
  in_analiza: { label: "În analiză", color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" },
  aprobat: { label: "Aprobat", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  respins: { label: "Respins", color: "bg-red-500/20 text-red-400 border-red-500/30" },
  in_implementare: { label: "În implementare", color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
};

export const projectStageConfig: Record<string, { label: string; color: string; order: number }> = {
  planificat: { label: "Planificat", color: "bg-slate-500/20 text-slate-400", order: 0 },
  proiectare: { label: "Proiectare", color: "bg-blue-500/20 text-blue-400", order: 1 },
  simulare: { label: "Simulare", color: "bg-indigo-500/20 text-indigo-400", order: 2 },
  testare: { label: "Testare", color: "bg-orange-500/20 text-orange-400", order: 3 },
  consultare_publica: { label: "Consultare publică", color: "bg-purple-500/20 text-purple-400", order: 4 },
  aprobare: { label: "Aprobare", color: "bg-cyan-500/20 text-cyan-400", order: 5 },
  in_lucru: { label: "În lucru", color: "bg-amber-500/20 text-amber-400", order: 6 },
  finalizat: { label: "Finalizat", color: "bg-green-500/20 text-green-400", order: 7 },
};

export const projectTypeLabels: Record<string, string> = {
  pista_biciclete: "Pistă de biciclete",
  parcare_biciclete: "Parcare biciclete",
  semaforizare: "Semaforizare",
  zona_30: "Zonă 30 km/h",
  zona_pietonala: "Zonă pietonală",
  coridor_verde: "Coridor verde",
  infrastructura_mixta: "Infrastructură mixtă",
};
